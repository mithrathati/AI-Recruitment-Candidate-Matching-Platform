import re
from typing import Any, Dict, List, Optional, Tuple

from app.config import settings
from app.services.embedding_service import embedding_service
from app.utils.file_utils import normalize_skill


class ScoringEngine:
    """
    Implements the weighted candidate scoring methodology:
      Category                     Weight (default)
      Required Skills               40%
      Relevant Experience           25%
      Projects                      20%
      Education / Certifications    10%
      Additional (nice-to-have)      5%

    All per-category scores are returned on a 0-100 scale.
    Overall score is the weighted sum, bounded [0, 100].
    """

    def __init__(self):
        w = settings
        self.W_SKILLS = w.WEIGHT_REQUIRED_SKILLS
        self.W_EXP = w.WEIGHT_EXPERIENCE
        self.W_PROJ = w.WEIGHT_PROJECTS
        self.W_EDU = w.WEIGHT_EDUCATION_CERT
        self.W_ADD = w.WEIGHT_ADDITIONAL_SKILLS

    # ------------------------------------------------------------------
    # Required skills score
    # ------------------------------------------------------------------
    def score_required_skills(
        self,
        required_skills: List[str],
        candidate_skills: List[str],
    ) -> Tuple[float, Dict[str, Any]]:
        """
        Returns (score 0..100, match_detail_dict).
        Uses semantic similarity + exact match.
        """
        if not required_skills:
            return 100.0, {
                "matched": [],
                "matched_required_names": [],
                "matched_candidate_names": [],
                "unmatched_required": [],
                "per_required_scores": {},
            }
        detail = embedding_service.match_skill_lists(
            required_skills, candidate_skills or [], threshold=0.68
        )
        per = detail.get("per_required_scores", {})
        if not per:
            return 0.0, detail
        avg = sum(per.values()) / len(per)
        score = round(min(100.0, avg * 100.0), 2)
        return score, detail

    # ------------------------------------------------------------------
    # Experience score
    # ------------------------------------------------------------------
    def score_experience(
        self,
        min_years_required: Optional[float],
        candidate_years: Optional[float],
        required_skills: List[str],
        candidate_experience_text: Optional[str],
        candidate_skills: List[str],
    ) -> float:
        if min_years_required is None and candidate_years is None:
            # No explicit requirement: base it on a quick skill-depth heuristic
            depth = self._experience_depth_from_text(
                required_skills, candidate_experience_text, candidate_skills
            )
            return round(min(100.0, 50.0 + 50.0 * depth), 2)

        # Years-based scoring
        if min_years_required is None or min_years_required <= 0:
            if candidate_years is None:
                return 60.0
            # No minimum, reward any experience up to 10 years
            return round(min(100.0, 55.0 + 4.5 * float(candidate_years)), 2)

        cand_y = float(candidate_years) if candidate_years is not None else 0.0
        req_y = float(min_years_required)
        ratio = cand_y / req_y if req_y > 0 else 1.0
        if ratio >= 1.5:
            base = 100.0
        elif ratio >= 1.0:
            base = 85.0 + min(15.0, (ratio - 1.0) * 30.0)
        elif ratio >= 0.75:
            base = 60.0 + (ratio - 0.75) * 4.0 * 25.0  # 60..100
        elif ratio >= 0.5:
            base = 40.0 + (ratio - 0.5) * 4.0 * 20.0   # 40..60
        else:
            base = 40.0 * max(0.0, ratio / 0.5)

        # Boost if experience text semantically confirms usage of required skills
        if required_skills and candidate_experience_text:
            query = " ".join(required_skills) + f" with {req_y} years experience"
            overlap = embedding_service.semantic_text_overlap_score(query, candidate_experience_text or "")
            base = base * 0.75 + overlap * 100.0 * 0.25

        return round(max(0.0, min(100.0, base)), 2)

    def _experience_depth_from_text(
        self,
        required_skills: List[str],
        experience_text: Optional[str],
        candidate_skills: List[str],
    ) -> float:
        if not required_skills:
            return 0.5
        hits = 0
        if experience_text:
            t_lower = experience_text.lower()
            for s in required_skills:
                if normalize_skill(s) and normalize_skill(s) in normalize_skill(experience_text):
                    hits += 1
                elif s.lower() in t_lower:
                    hits += 1
        share = hits / len(required_skills)
        if candidate_skills:
            common = len([s for s in required_skills if s in candidate_skills]) / max(1, len(required_skills))
            share = 0.6 * share + 0.4 * common
        return max(0.0, min(1.0, share))

    # ------------------------------------------------------------------
    # Projects score
    # ------------------------------------------------------------------
    def score_projects(
        self,
        projects: List[Dict[str, Any]],
        required_skills: List[str],
        *,
        experience_text: Optional[str] = None,
        candidate_skills: Optional[List[str]] = None,
    ) -> float:
        if not projects:
            # Graceful fallback: if no projects were extracted, derive project-relevant evidence from
            # experience descriptions / skill depth as a soft proxy (candidate skills overlap plus any
            # project-like bullet points.
            return round(self._projects_proxy_project_score(required_skills, experience_text, candidate_skills), 2)
        if not required_skills:
            return round(min(100.0, 40.0 + 15.0 * len(projects)), 2)

        # Per-project best semantic overlap with requirements query
        query = " ".join(required_skills) + " project implementation using these technologies"
        per_project = []
        for p in projects:
            text_bits = []
            if isinstance(p, dict):
                for k in ("title", "name", "summary", "description", "tech", "stack"):
                    v = p.get(k)
                    if v:
                        text_bits.append(str(v))
            p_text = "\n".join(text_bits)
            if not p_text:
                per_project.append(0.0)
                continue
            s = embedding_service.semantic_text_overlap_score(query, p_text)
            # Exact-skill bonus
            bonus = 0.0
            for rs in required_skills:
                if normalize_skill(rs) and normalize_skill(rs) in normalize_skill(p_text):
                    bonus += 0.05
                elif rs.lower() in p_text.lower():
                    bonus += 0.04
            per_project.append(min(1.0, s + bonus))

        if not per_project:
            return 0.0
        # Weighted: top project strongly, then rest
        per_project.sort(reverse=True)
        weights = [0.5, 0.25, 0.15, 0.05, 0.05]
        score = 0.0
        for i, w in enumerate(weights):
            if i < len(per_project):
                score += w * per_project[i]
        # Quantity bonus: up to +15 for >=4 projects
        quant_bonus = min(15.0, 3.75 * max(0, len(projects) - 1))
        final = min(100.0, score * 100.0 + quant_bonus)
        return round(final, 2)

    def _projects_proxy_project_score(
        self,
        required_skills: List[str],
        experience_text: Optional[str],
        candidate_skills: Optional[List[str]],
    ) -> float:
        if not required_skills:
            return 40.0
        base = 20.0  # soft floor
        c_skills = candidate_skills or []
        skill_share = 0.0
        if required_skills:
            req_norm = {normalize_skill(s) for s in required_skills if normalize_skill(s)}
            cand_norm = {normalize_skill(s) for s in c_skills if normalize_skill(s)}
            overlap = req_norm & cand_norm
            skill_share = len(overlap) / max(1, len(req_norm))
        base += 60.0 * skill_share
        if experience_text and skill_share:
            sim = embedding_service.semantic_text_overlap_score(
                "project implementation " + " ".join(required_skills),
                experience_text,
            )
            base += 20.0 * min(1.0, sim)
        if c_skills and experience_text:
            base += min(15.0, min(len(c_skills) / 10.0, 1.0) * 15.0)
        return max(10.0, min(95.0, base))

    # ------------------------------------------------------------------
    # Education + certifications score
    # ------------------------------------------------------------------
    def score_education_cert(
        self,
        education_list: List[Dict[str, Any]],
        certifications: List[str],
        required_education: Optional[str],
        required_skills: List[str],
    ) -> float:
        score = 40.0  # baseline: assume minimal

        edu_texts = []
        if education_list:
            for e in education_list:
                if isinstance(e, dict):
                    bits = [str(v) for v in e.values() if v is not None]
                elif isinstance(e, str):
                    bits = [e]
                else:
                    bits = []
                if bits:
                    edu_texts.append(" ".join(bits))

        edu_join = " | ".join(edu_texts)
        level_points = self._education_level_points(edu_join)
        score = max(score, level_points)

        # Required-education boost / penalty
        if required_education:
            req_norm = normalize_skill(required_education)
            candidate_any = normalize_skill(edu_join)
            if req_norm and req_norm in candidate_any:
                score += 20
            else:
                sim = embedding_service.semantic_similarity(required_education, edu_join or "no degree")
                if sim >= 0.7:
                    score += 10 + int(10 * sim)
                else:
                    score -= 15

        # Certifications score
        cert_bonus = 0.0
        if certifications:
            cert_bonus += min(20.0, 5.0 * len(certifications))
            # Bonus for certs aligned with required skills
            cert_join = " ".join(certifications)
            if required_skills:
                _, top = embedding_service.semantic_match_many(
                    " ".join(required_skills) + " certification",
                    certifications,
                    threshold=0.6,
                )
                cert_bonus += min(15.0, 5.0 * len(top))
        score += cert_bonus

        return round(max(0.0, min(100.0, score)), 2)

    @staticmethod
    def _education_level_points(text: str) -> float:
        if not text:
            return 40.0
        t = text.lower()
        if any(k in t for k in ["phd", "ph.d", "doctorate"]):
            return 95
        if any(k in t for k in ["master", "mtech", "m.tech", "mba", "msc", "m.sc", "m.e", "me "]):
            return 85
        if any(k in t for k in ["bachelor", "btech", "b.tech", "b.sc", "bsc", "b.e", "bcom", "b.com", "be "]):
            return 75
        if any(k in t for k in ["diploma", "associate"]):
            return 60
        if any(k in t for k in ["university", "college", "graduate", "graduated"]):
            return 55
        return 45

    # ------------------------------------------------------------------
    # Additional / nice-to-have skills
    # ------------------------------------------------------------------
    def score_additional_skills(
        self,
        nice_to_have: List[str],
        candidate_skills: List[str],
        additional_skills: List[str],
    ) -> float:
        if not nice_to_have:
            return 50.0
        pool = list(candidate_skills or []) + list(additional_skills or [])
        if not pool:
            return 0.0
        detail = embedding_service.match_skill_lists(nice_to_have, pool, threshold=0.65)
        per = detail.get("per_required_scores", {})
        if not per:
            return 0.0
        avg = sum(per.values()) / len(per)
        return round(min(100.0, avg * 100.0), 2)

    # ------------------------------------------------------------------
    # Skill gap helper
    # ------------------------------------------------------------------
    def identify_skill_gaps(
        self,
        required_skills: List[str],
        match_detail: Dict[str, Any],
        candidate_skills: List[str],
    ) -> Tuple[List[str], List[str]]:
        if not required_skills:
            return [], []
        matched_names = match_detail.get("matched_required_names") or []
        unmatched = [r for r in required_skills if r not in matched_names]
        # Also surface weak matches (<0.85) as "weak" skills even if technically matched
        weak = []
        per = match_detail.get("per_required_scores", {})
        for req, score in per.items():
            if req in matched_names and score < 0.85 and score > 0.0:
                weak.append(req)
        missing = sorted(set(unmatched + weak), key=lambda x: required_skills.index(x) if x in required_skills else 999)
        return matched_names, missing

    # ------------------------------------------------------------------
    # Overall score
    # ------------------------------------------------------------------
    def overall_score(
        self,
        scores: Dict[str, float],
    ) -> float:
        total_w = self.W_SKILLS + self.W_EXP + self.W_PROJ + self.W_EDU + self.W_ADD
        if total_w <= 0:
            return 0.0
        weighted = (
            (scores.get("required_skills_score", 0.0) or 0.0) * self.W_SKILLS +
            (scores.get("experience_score", 0.0) or 0.0) * self.W_EXP +
            (scores.get("projects_score", 0.0) or 0.0) * self.W_PROJ +
            (scores.get("education_cert_score", 0.0) or 0.0) * self.W_EDU +
            (scores.get("additional_skills_score", 0.0) or 0.0) * self.W_ADD
        ) / total_w
        return round(max(0.0, min(100.0, weighted)), 2)


scoring_engine = ScoringEngine()


def score_candidate(
    job_req: Dict[str, Any],
    candidate_profile: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Full scoring pipeline for one candidate vs a job requirement dict.
    Returns dict with:
        scores (per-category + overall)
        skill_gap (matching, missing)
        match_detail (raw)
        strengths, weaknesses (initial heuristic bullets, may be refined by LLM)
    """
    req_skills = job_req.get("required_skills") or []
    nice_to_have = job_req.get("nice_to_have_skills") or []
    min_exp = job_req.get("min_experience_years")
    req_edu = job_req.get("required_education")

    c_skills = candidate_profile.get("skills") or []
    c_exp_yrs = candidate_profile.get("experience_years")
    c_exp_text = candidate_profile.get("experience_summary")
    c_projects = candidate_profile.get("projects") or []
    c_edu = candidate_profile.get("education") or []
    c_certs = candidate_profile.get("certifications") or []
    c_add = candidate_profile.get("additional_skills") or []

    skill_score, match_detail = scoring_engine.score_required_skills(req_skills, c_skills)
    exp_score = scoring_engine.score_experience(min_exp, c_exp_yrs, req_skills, c_exp_text, c_skills)
    proj_score = scoring_engine.score_projects(
        c_projects, req_skills, experience_text=c_exp_text, candidate_skills=c_skills
    )
    edu_score = scoring_engine.score_education_cert(c_edu, c_certs, req_edu, req_skills)
    add_score = scoring_engine.score_additional_skills(nice_to_have, c_skills, c_add)

    per = {
        "required_skills_score": skill_score,
        "experience_score": exp_score,
        "projects_score": proj_score,
        "education_cert_score": edu_score,
        "additional_skills_score": add_score,
    }
    overall = scoring_engine.overall_score(per)
    matching, missing = scoring_engine.identify_skill_gaps(req_skills, match_detail, c_skills)

    return {
        "overall_score": overall,
        "scores": per,
        "skill_gap": {"matching_skills": matching, "missing_skills": missing},
        "match_detail": match_detail,
    }


def rank_candidates(scored_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Assign 'rank' field based on overall_score descending.
    scored_list is expected to be a list of dicts that each have at least
    'overall_score' key; it is mutated to include 'rank'.
    """
    ordered = sorted(scored_list, key=lambda x: x.get("overall_score", 0.0), reverse=True)
    for i, entry in enumerate(ordered, start=1):
        entry["rank"] = i
    return ordered
