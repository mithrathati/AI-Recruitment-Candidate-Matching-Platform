import json
import re
from typing import Any, Dict, List, Optional, Tuple
from app.config import settings
from app.utils.exceptions import (
    LLMServiceError,
    LLMResponseParseError,
    MissingCandidateInformationError,
    MissingJobDescriptionError,
)
from app.utils.file_utils import chunk_text


_PROJECT_HDR = re.compile(
    r"^\s*(?:\d+\.?\s*[-–.)]\s*)?(project[s]?|personal\s+projects|key\s+projects|side\s+projects)\s*[:\-]?\s*$",
    re.IGNORECASE,
)
_CERT_HDR = re.compile(
    r"^\s*(?:certifications?|certificates?|licenses?|credentials?)\s*[:\-]?\s*$",
    re.IGNORECASE,
)
_EXP_HDR = re.compile(
    r"^\s*(?:experience|work\s*experience|professional\s*experience|employment\s*history|work\s*history|career)\s*[:\-]?\s*$",
    re.IGNORECASE,
)
_ANY_SECTION_HDR = re.compile(
    r"^\s*(?:education|skills|technical\s+skills|summary|objective|about|languages?|awards?|achievements?|publications?|references?|volunteer|extracurricular|interests?|projects?|certifications?|experience|qualifications?)\s*[:\-]?\s*$",
    re.IGNORECASE,
)
_PROJECT_TITLE = re.compile(r"^\s*(?:\d+[.)]\s*|\-\s*|•\s*|\*\s*)?(?:Title\s*:\s*)?(.+)$", re.IGNORECASE)
_DESC_HINT = re.compile(
    r"^\s*(?:(?:description|summary|about|details?|tech(?:nology|nologies)?|stack)\s*[:\-]\s*)?(.+)$",
    re.IGNORECASE,
)


def _parse_sections(text: str) -> Dict[str, Any]:
    """
    Naive-but-effective section parser for resumes. Detects:
      - EXPERIENCE section -> list of non-header lines in-section
      - PROJECTS section -> list of {title, description}
      - CERTIFICATIONS section -> list of certification lines

    Works when resumes use standard section headings (ALL CAPS, colon, underline
    keywords, etc.). Returns empty dicts/lists when sections are not present.
    """
    lines = text.splitlines()
    current: Optional[str] = None
    sections: Dict[str, List[str]] = {}
    for raw in lines:
        line = raw.rstrip()
        stripped = line.strip()
        if not stripped:
            continue
        if _EXP_HDR.match(stripped):
            current = "experience"
            sections.setdefault(current, [])
            continue
        if _PROJECT_HDR.match(stripped):
            current = "projects"
            sections.setdefault(current, [])
            continue
        if _CERT_HDR.match(stripped):
            current = "certifications"
            sections.setdefault(current, [])
            continue
        # If another section header appears, reset current (stop consuming for previous section)
        if _ANY_SECTION_HDR.match(stripped):
            current = None
            continue
        if current:
            sections[current].append(stripped)

    out: Dict[str, Any] = {}
    out["experience"] = sections.get("experience", [])
    out["certifications"] = sections.get("certifications", [])
    out["projects"] = _parse_project_entries(sections.get("projects", []))
    return out


def _parse_project_entries(lines: List[str]) -> List[Dict[str, str]]:
    """
    Parse project lines into [{title, description}, ...].

    Heuristic: a new project starts either with:
      * numbering (`1. ...` / `- ...` / `* ...`)
      * short-ish (<= 90 chars) "title-like" line not starting with common desc
        keywords like Description/Summary/Tech/Stack
      * explicit `Title:` prefix

    Subsequent lines accumulate into description until a new title is seen.
    """
    projects: List[Dict[str, str]] = []
    current_title: Optional[str] = None
    current_desc_parts: List[str] = []

    def flush():
        if current_title:
            projects.append({
                "title": current_title.strip(" :-"),
                "description": " ".join(current_desc_parts).strip(),
            })

    def looks_like_title(s: str) -> bool:
        if len(s) > 110:
            return False
        if s.lower().startswith(("description", "summary", "details", "tech", "stack", "about")):
            return False
        if len(s.split()) > 14:
            return False
        return True

    for line in lines:
        s = line.strip()
        if not s:
            continue
        title_prefix = re.match(r"^\s*(?:Title|Project)\s*[:\-]\s*(.+)$", s, re.IGNORECASE)
        bullet_start = bool(re.match(r"^\s*(?:\d+[.)]|\-|•|\*|[a-zA-Z][.)])\s+", s))

        if title_prefix:
            flush()
            current_title = title_prefix.group(1)
            current_desc_parts = []
            continue

        if bullet_start:
            # New numbered/bulleted line — if there was no open title OR this line looks short-ish title
            cleaned = re.sub(r"^\s*(?:\d+[.)]|\-|•|\*|[a-zA-Z][.)])\s+", "", s).strip()
            if current_title is None or looks_like_title(cleaned):
                flush()
                # first part (up to first period / "Description:") is title, rest desc
                m_title = re.match(r"^(.{2,90}?)(?:[.。]?\s+(?:Description|Summary|About|Tech|Stack)\s*[:\-]\s*(.*))?$", cleaned)
                if m_title:
                    current_title = m_title.group(1).rstrip(" :-")
                    rest = m_title.group(2)
                    current_desc_parts = [rest] if rest else []
                else:
                    current_title = cleaned
                    current_desc_parts = []
            else:
                # Bulleted continuation for description
                current_desc_parts.append(cleaned)
            continue

        # Plain line: either title or description text
        if looks_like_title(s) and current_title is None:
            current_title = s
            current_desc_parts = []
        else:
            m_desc = _DESC_HINT.match(s)
            if m_desc:
                current_desc_parts.append(m_desc.group(1).strip())
            else:
                current_desc_parts.append(s)

    flush()
    return projects


class LLMService:
    """
    Unified LLM service. Uses OpenAI API when OPENAI_API_KEY is configured,
    and falls back to a rule-based heuristic extractor so the app remains
    fully functional offline / during API failures.
    """

    def __init__(self):
        self.api_key = settings.OPENAI_API_KEY
        self.model = settings.OPENAI_MODEL
        self.embedding_model = settings.OPENAI_EMBEDDING_MODEL
        self.temperature = settings.OPENAI_TEMPERATURE
        self.max_tokens = settings.OPENAI_MAX_TOKENS
        self._client = None
        self._init_client()

    def _init_client(self):
        if not self.api_key:
            return
        try:
            from openai import OpenAI
            self._client = OpenAI(api_key=self.api_key)
        except Exception:
            self._client = None

    @property
    def is_llm_available(self) -> bool:
        return self._client is not None

    # =================================================================
    # Chat completion wrapper
    # =================================================================
    def _chat_completion(self, system: str, user: str, json_mode: bool = False) -> str:
        if not self.is_llm_available:
            raise LLMServiceError(
                "LLM service is not configured. Set OPENAI_API_KEY in .env or "
                "ensure rule-based fallback is acceptable."
            )
        try:
            kwargs: Dict[str, Any] = dict(
                model=self.model,
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
            )
            if json_mode:
                kwargs["response_format"] = {"type": "json_object"}
            resp = self._client.chat.completions.create(**kwargs)
            return resp.choices[0].message.content or ""
        except Exception as e:
            raise LLMServiceError(f"LLM request failed: {str(e)}")

    def _try_parse_json(self, text: str) -> Dict[str, Any]:
        try:
            return json.loads(text)
        except Exception:
            m = re.search(r"\{[\s\S]+\}", text)
            if m:
                try:
                    return json.loads(m.group(0))
                except Exception:
                    pass
        raise LLMResponseParseError("Failed to parse LLM output as JSON.")

    # =================================================================
    # Job requirement extraction
    # =================================================================
    def extract_job_requirements(self, description: str, title: str) -> Dict[str, Any]:
        if not description or not title:
            raise MissingJobDescriptionError("Job title and description are required.")

        text = f"JOB TITLE: {title}\n\n{description}"
        if self.is_llm_available:
            system = (
                "You are a recruitment AI that extracts structured requirements from Job "
                "Descriptions. Return ONLY JSON and nothing else with keys: "
                "required_skills (array of strings), nice_to_have_skills (array of strings), "
                "min_experience_years (number or null), required_education (string or null), "
                "requirements_summary (short string)."
            )
            for chunk in chunk_text(text, max_chars=8000):
                try:
                    out = self._chat_completion(system, chunk, json_mode=True)
                    parsed = self._try_parse_json(out)
                    return self._normalize_job(parsed)
                except LLMResponseParseError:
                    continue
                except LLMServiceError:
                    break

        return self._fallback_extract_job(title, description)

    @staticmethod
    def _normalize_job(obj: Dict[str, Any]) -> Dict[str, Any]:
        def _lst(v):
            if v is None:
                return []
            if isinstance(v, list):
                return [str(x).strip() for x in v if str(x).strip()]
            if isinstance(v, str):
                return [s.strip() for s in re.split(r"[,;\n]", v) if s.strip()]
            return []

        exp = obj.get("min_experience_years")
        try:
            if exp is None or exp == "":
                exp_out = None
            else:
                exp_out = float(exp)
        except (TypeError, ValueError):
            exp_out = None

        edu = obj.get("required_education")
        if edu is None:
            edu_out = None
        else:
            edu_out = str(edu).strip() or None

        return {
            "required_skills": _lst(obj.get("required_skills")),
            "nice_to_have_skills": _lst(obj.get("nice_to_have_skills")),
            "min_experience_years": exp_out,
            "required_education": edu_out,
            "requirements_summary": str(obj.get("requirements_summary") or "")[:500] or None,
        }

    def _fallback_extract_job(self, title: str, description: str) -> Dict[str, Any]:
        text = f"{title} {description}"
        common_skills = [
            "Python", "FastAPI", "Django", "Flask", "Node.js", "Express", "React", "Vue",
            "Angular", "JavaScript", "TypeScript", "Java", "Spring Boot", "C++", "C#", ".NET",
            "Go", "Rust", "Ruby", "PHP", "Laravel", "SQL", "MySQL", "PostgreSQL", "MongoDB",
            "Redis", "Elasticsearch", "Docker", "Kubernetes", "AWS", "Azure", "GCP", "CI/CD",
            "Git", "Linux", "REST API", "GraphQL", "Microservices", "Machine Learning", "NLP",
            "Computer Vision", "TensorFlow", "PyTorch", "Scikit-learn", "Pandas", "Data Analysis",
            "Excel", "Power BI", "Tableau", "Agile", "Scrum", "Jira", "HTML", "CSS", "Sass",
            "Tailwind CSS", "Next.js", "Nuxt", "Jenkins", "Terraform", "Ansible", "Prometheus",
            "Hadoop", "Spark", "Kafka", "Snowflake", "BigQuery", "Airflow", "dbt",
            "Communication", "Teamwork", "Leadership", "Problem Solving",
        ]
        t_lower = text.lower()
        found_required = []
        for s in common_skills:
            if s.lower() in t_lower and s not in found_required:
                found_required.append(s)

        exp_years = None
        m = re.search(r"(\d+(?:\.\d+)?)\s*(?:\+|plus)?\s*(?:years? of experience|years? exp|yrs)", text, re.IGNORECASE)
        if m:
            try:
                exp_years = float(m.group(1))
            except ValueError:
                exp_years = None
        else:
            m2 = re.search(r"minimum\s*(?:of\s*)?(\d+)", text, re.IGNORECASE)
            if m2:
                try:
                    exp_years = float(m2.group(1))
                except ValueError:
                    exp_years = None

        edu = None
        for key in ["bachelor", "b.tech", "btech", "b.sc", "msc", "master", "phd", "be ", "b.e.", "graduate", "diploma"]:
            if key in t_lower:
                edu = key.title().replace(".", ". ")
                break

        return {
            "required_skills": found_required[:15],
            "nice_to_have_skills": found_required[15:22],
            "min_experience_years": exp_years,
            "required_education": edu,
            "requirements_summary": (description[:280] + "...") if len(description) > 280 else description,
        }

    # =================================================================
    # Candidate profile extraction
    # =================================================================
    def extract_candidate_profile(self, resume_text: str) -> Dict[str, Any]:
        if not resume_text or len(resume_text.strip()) < 40:
            raise MissingCandidateInformationError(
                "Resume text is too short. Could not extract candidate profile."
            )

        if self.is_llm_available:
            system = (
                "You are a recruitment AI that extracts a structured candidate profile from a resume. "
                "Return ONLY JSON with keys: name (string|null), email (string|null), phone (string|null), "
                "skills (array of strings), experience_years (number|null), experience_summary (string|null), "
                "education (array of {degree, school, year}|[]), projects (array of {title, description}|[]), "
                "certifications (array of strings), additional_skills (array of strings)."
            )
            for chunk in chunk_text(resume_text, max_chars=8000):
                try:
                    out = self._chat_completion(system, chunk, json_mode=True)
                    parsed = self._try_parse_json(out)
                    norm = self._normalize_candidate(parsed)
                    if norm.get("skills") or norm.get("name"):
                        return norm
                except LLMResponseParseError:
                    continue
                except LLMServiceError:
                    break

        return self._fallback_extract_candidate(resume_text)

    @staticmethod
    def _normalize_candidate(obj: Dict[str, Any]) -> Dict[str, Any]:
        def _lst(v):
            if v is None:
                return []
            if isinstance(v, list):
                if v and isinstance(v[0], dict):
                    return v
                return [str(x).strip() for x in v if str(x).strip()]
            if isinstance(v, str):
                return [s.strip() for s in re.split(r"[,;\n]", v) if s.strip()]
            return []

        exp = obj.get("experience_years")
        try:
            exp_out = float(exp) if exp not in (None, "", "null") else None
        except (TypeError, ValueError):
            exp_out = None

        edu = obj.get("education") or []
        if isinstance(edu, list) and all(isinstance(x, str) for x in edu):
            edu = [{"degree": x, "school": "", "year": None} for x in edu]

        proj = obj.get("projects") or []
        if isinstance(proj, list) and all(isinstance(x, str) for x in proj):
            proj = [{"title": x, "description": ""} for x in proj]

        certs = obj.get("certifications") or []
        if isinstance(certs, str):
            certs = [certs]

        return {
            "name": (str(obj.get("name") or "").strip() or None),
            "email": (str(obj.get("email") or "").strip() or None),
            "phone": (str(obj.get("phone") or "").strip() or None),
            "skills": _lst(obj.get("skills")),
            "experience_years": exp_out,
            "experience_summary": (str(obj.get("experience_summary") or "")[:800] or None),
            "education": edu[:10],
            "projects": proj[:20],
            "certifications": [str(c).strip() for c in certs if str(c).strip()][:20],
            "additional_skills": _lst(obj.get("additional_skills")),
        }

    def _fallback_extract_candidate(self, text: str) -> Dict[str, Any]:
        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
        name = lines[0][:60] if lines else None

        email = None
        m = re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", text)
        if m:
            email = m.group(0)

        phone = None
        pm = re.search(r"(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}", text)
        if pm:
            phone = pm.group(0)

        common_skills = [
            "Python", "FastAPI", "Django", "Flask", "Node.js", "Express", "React", "Vue",
            "Angular", "JavaScript", "TypeScript", "Java", "Spring Boot", "C++", "C#", ".NET",
            "Go", "Rust", "Ruby", "PHP", "Laravel", "SQL", "MySQL", "PostgreSQL", "MongoDB",
            "Redis", "Elasticsearch", "Docker", "Kubernetes", "AWS", "Azure", "GCP", "CI/CD",
            "Git", "Linux", "REST API", "GraphQL", "Microservices", "Machine Learning", "NLP",
            "Computer Vision", "TensorFlow", "PyTorch", "Scikit-learn", "Pandas", "Data Analysis",
            "Excel", "Power BI", "Tableau", "Agile", "Scrum", "Jira", "HTML", "CSS", "Sass",
            "Tailwind CSS", "Next.js", "Nuxt", "Jenkins", "Terraform", "Ansible", "Prometheus",
            "Hadoop", "Spark", "Kafka", "Snowflake", "BigQuery", "Airflow", "dbt",
            "Communication", "Teamwork", "Leadership", "Problem Solving", "Prompt Engineering",
            "Object-Oriented Programming", "API Development", "Backend", "Frontend", "Full Stack",
            "Unit Testing", "Pytest", "Jest", "TDD", "DevOps", "Generative AI", "LangChain",
        ]
        t_lower = text.lower()
        found_skills = []
        for s in common_skills:
            if s.lower() in t_lower and s not in found_skills:
                found_skills.append(s)

        exp_years = None
        patterns = [
            r"(\d+(?:\.\d+)?)\+?\s*(?:years? of experience|years?\s*(?:in|of|experience)?|yrs)",
            r"(?:overall|total)\s+(?:experience\s+)?(?:of\s+)?(\d+(?:\.\d+)?)\s*\+?\s*years?",
        ]
        for p in patterns:
            m = re.search(p, text, re.IGNORECASE)
            if m:
                try:
                    exp_years = float(m.group(1))
                    break
                except ValueError:
                    continue

        if exp_years is None:
            durations = re.findall(r"(20\d{2})\s*[-–]\s*(20\d{2}|present|current)", text, re.IGNORECASE)
            years_total = 0.0
            for start, end in durations:
                try:
                    s = int(start)
                    if end.lower() in ("present", "current"):
                        e = 2025
                    else:
                        e = int(end)
                    years_total += max(0.0, e - s)
                except ValueError:
                    continue
            if years_total > 0:
                exp_years = round(min(years_total, 40.0), 1)

        edu_entries = []
        degrees = ["B.Tech", "B.E.", "B.Sc", "M.Tech", "M.E.", "M.Sc", "M.B.A", "B.Com", "B.A", "M.A", "Ph.D", "Diploma", "Bachelor", "Master"]
        for line in lines:
            for d in degrees:
                if d.lower() in line.lower():
                    edu_entries.append({"degree": line[:140], "school": "", "year": None})
                    break
            if len(edu_entries) >= 5:
                break

        # Section-aware parsing for PROJECTS and CERTIFICATIONS sections.
        sections = _parse_sections(text)

        projects = []
        for pr in sections.get("projects", [])[:20]:
            projects.append({"title": pr["title"], "description": pr["description"]})

        certifications = []
        for cert_line in sections.get("certifications", []):
            cert_line_clean = cert_line.strip(" -*•.")
            if cert_line_clean:
                certifications.append(cert_line_clean[:140])

        experience_summary = None
        exp_section = sections.get("experience", [])
        if exp_section:
            experience_summary = " ".join(exp_section)[:800]

        return {
            "name": name,
            "email": email,
            "phone": phone,
            "skills": found_skills[:30],
            "experience_years": exp_years,
            "experience_summary": experience_summary,
            "education": edu_entries,
            "projects": projects,
            "certifications": certifications,
            "additional_skills": [],
        }

    # =================================================================
    # Explanation / strengths & weaknesses generation
    # =================================================================
    def generate_explanation(
        self,
        job_title: str,
        job_req: Dict[str, Any],
        candidate_name: str,
        profile: Dict[str, Any],
        scores: Dict[str, float],
        matching_skills: List[str],
        missing_skills: List[str],
        strengths: List[str],
        weaknesses: List[str],
        overall_score: float,
    ) -> Tuple[str, List[str], List[str]]:
        req_skills = job_req.get("required_skills") or []
        if not strengths:
            strengths = self._heuristic_strengths(
                candidate_name, matching_skills, profile.get("experience_years"),
                job_req.get("min_experience_years"), scores
            )
        if not weaknesses:
            weaknesses = self._heuristic_weaknesses(missing_skills, req_skills, scores)

        if self.is_llm_available:
            system = (
                "You are a senior recruitment assistant. Provide a concise, fair, professional "
                "recruitment explanation (200-300 words) covering overall fit, major strengths, "
                "major weaknesses, and a hiring recommendation. Return ONLY JSON with keys: "
                "explanation (string), strengths (array of short strings), weaknesses (array of short strings)."
            )
            user = (
                f"JOB TITLE: {job_title}\n"
                f"JOB REQUIRED SKILLS: {req_skills}\n"
                f"JOB MIN EXPERIENCE: {job_req.get('min_experience_years')}\n"
                f"CANDIDATE: {candidate_name or 'Unknown'}\n"
                f"CANDIDATE SKILLS: {profile.get('skills') or []}\n"
                f"CANDIDATE EXP YEARS: {profile.get('experience_years')}\n"
                f"CANDIDATE EDUCATION: {profile.get('education') or []}\n"
                f"CANDIDATE PROJECTS: {profile.get('projects') or []}\n"
                f"CANDIDATE CERTIFICATIONS: {profile.get('certifications') or []}\n"
                f"OVERALL MATCH SCORE: {overall_score:.1f}%\n"
                f"MATCHING SKILLS: {matching_skills}\n"
                f"MISSING SKILLS: {missing_skills}\n"
                f"PRELIM STRENGTHS: {strengths}\n"
                f"PRELIM WEAKNESSES: {weaknesses}\n"
            )
            try:
                out = self._chat_completion(system, user, json_mode=True)
                parsed = self._try_parse_json(out)
                expl = str(parsed.get("explanation") or "")
                new_s = [str(x).strip() for x in (parsed.get("strengths") or []) if str(x).strip()]
                new_w = [str(x).strip() for x in (parsed.get("weaknesses") or []) if str(x).strip()]
                if expl:
                    return expl[:800], (new_s or strengths)[:6], (new_w or weaknesses)[:6]
            except Exception:
                pass

        explanation = self._heuristic_explanation(
            job_title, candidate_name, overall_score, matching_skills, missing_skills,
            strengths, weaknesses
        )
        return explanation, strengths[:6], weaknesses[:6]

    @staticmethod
    def _heuristic_strengths(name, matching, exp_years, req_exp, scores):
        s = []
        if len(matching) >= 4:
            s.append(f"Strong alignment in core skills: {', '.join(matching[:5])}.")
        elif matching:
            s.append(f"Matches core skills: {', '.join(matching)}.")
        if exp_years is not None:
            if req_exp is None or exp_years >= req_exp:
                s.append(f"Experience ({exp_years} yrs) meets or exceeds the requirement.")
            else:
                s.append(f"Some relevant experience ({exp_years} yrs).")
        if scores and scores.get("projects_score", 0) >= 70:
            s.append("Strong project portfolio evidence.")
        if scores and scores.get("education_cert_score", 0) >= 70:
            s.append("Good educational / certification background.")
        if not s:
            s.append("Partial skill overlap with job requirements.")
        return s

    @staticmethod
    def _heuristic_weaknesses(missing, req_skills, scores):
        w = []
        if missing:
            w.append(f"Missing key skills: {', '.join(missing[:6])}.")
        if scores and scores.get("experience_score", 100) < 50:
            w.append("Insufficient relevant experience compared to requirement.")
        if scores and scores.get("projects_score", 100) < 40:
            w.append("Limited demonstrated project work in relevant areas.")
        if not w and req_skills:
            w.append("No significant weaknesses detected; consider behavioral interview signals.")
        return w

    @staticmethod
    def _heuristic_explanation(job_title, name, score, matching, missing, strengths, weaknesses):
        n = name or "The candidate"
        lines = []
        if score >= 85:
            verdict = "an excellent match and a strong hire recommendation"
        elif score >= 70:
            verdict = "a good match; recommended for interview"
        elif score >= 50:
            verdict = "a partial match; consider for phone screen if pipeline is limited"
        else:
            verdict = "not a strong match at this time"
        lines.append(f"{n} is {verdict} for the {job_title} role (overall match: {score:.1f}%).")
        if matching:
            lines.append(f"Key skill overlap includes: {', '.join(matching[:6])}.")
        if missing:
            lines.append(f"Notable gaps include: {', '.join(missing[:6])}.")
        if strengths:
            lines.append("Major strengths: " + " ".join(strengths))
        if weaknesses:
            lines.append("Major weaknesses / gaps: " + " ".join(weaknesses))
        lines.append(
            "Recommendation: weigh the severity of missing skills against the candidate's "
            "demonstrated learning ability and project work before final shortlisting."
        )
        return " ".join(lines)


llm_service = LLMService()
