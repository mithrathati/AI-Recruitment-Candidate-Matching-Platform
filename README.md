# AI Recruitment & Candidate Matching Platform

> A Generative AI-powered recruitment platform. Upload a Job Description and candidate resumes; the platform extracts structured information, runs semantic matching via embeddings, scores candidates on multiple dimensions, ranks them, analyzes skill gaps, and produces AI-generated hiring explanations.

**3-Week Final Project · Dstarix Technology Generative AI Internship**

---

## 1. Project Overview

The AI Recruitment Platform helps recruiters in the *initial candidate-screening phase*. Instead of manually comparing hundreds of resumes against a Job Description, the recruiter:

1. Creates or uploads a **Job Description**.
2. Uploads **one or many candidate resumes** (PDF, DOCX, TXT).
3. The system **extracts structured data** from both using an LLM.
4. **Embeddings + semantic matching** compare the candidate profiles to the JD requirements.
5. A **weighted scoring engine** computes an overall match score (0–100%).
6. Candidates are **ranked**. The recruiter can immediately see:
   - Matching skills / missing skills (skill gap analysis)
   - Per-category score breakdown
   - AI-generated strengths / weaknesses / hiring recommendation

---

## 2. Problem Statement

Recruiters often receive **hundreds of resumes per opening**. Manually reviewing every candidate is slow, subjective, and scales poorly. Most existing screening tools rely on *exact keyword matching*, which misses strong candidates who express the same concepts differently (e.g. *"Postgres on AWS"* vs *"PostgreSQL on Amazon cloud"*).

The proposed platform solves this by:
- Using **LLMs** for flexible structured extraction.
- Using **embeddings + cosine similarity** for semantic, not keyword, comparison.
- Producing **transparent per-category scores** plus a **human-readable AI explanation**.

---

## 3. Objectives

- Build a fully functional **FastAPI backend** with all required endpoints.
- Process **PDF, DOCX, TXT** resumes and validate documents.
- Structured extraction of:
  - JD: required skills, nice-to-have skills, min experience, required education.
  - Resume: name, email, phone, skills, experience, education, projects, certifications.
- Implement **embeddings & semantic matching** with multiple backends.
- Build a **weighted scoring & ranking engine**.
- Skill-gap analysis and AI-generated explanation for each candidate.
- Proper **error handling** for all failure modes.
- **Automated tests** covering the main scenarios.
- Complete **README, architecture diagram, test cases, sample resumes/JDs**.

---

## 4. Features

| # | Feature | Status |
|---|---------|--------|
| 1 | Create / view / list Job Descriptions | ✅ |
| 2 | Requirement extraction from JD (skills, experience, education) | ✅ |
| 3 | Resume batch upload (PDF, DOCX, TXT) with validation | ✅ |
| 4 | Structured candidate profile extraction | ✅ |
| 5 | Semantic embeddings matching (not only keywords) | ✅ |
| 6 | Multi-category weighted scoring | ✅ |
| 7 | Candidate ranking by score | ✅ |
| 8 | Skill-gap analysis (matching / missing / weak skills) | ✅ |
| 9 | AI explanation with strengths / weaknesses / recommendation | ✅ |
| 10 | Multiple embeddings backends (local / OpenAI / TF-IDF fallback) | ✅ |
| 11 | Full error handling with typed exceptions + HTTP codes | ✅ |
| 12 | SQLite database persistence | ✅ |
| 13 | Automated pytest suite (document / LLM / embed / score / API) | ✅ |
| 14 | Swagger UI / ReDoc auto-docs on `/docs` and `/redoc` | ✅ |

---

## 5. Technology Stack

| Layer | Tools |
|-------|-------|
| **Backend Framework** | FastAPI 0.110, Pydantic v2 |
| **ASGI Server** | Uvicorn |
| **Database / ORM** | SQLite + SQLAlchemy 2.0 |
| **Document Processing** | pdfplumber (PDF), python-docx (DOCX), stdlib (TXT) |
| **LLM** | OpenAI GPT-3.5/4 via official SDK; built-in rule-based fallback |
| **Embeddings (Primary)** | sentence-transformers (`all-MiniLM-L6-v2`) — offline, open |
| **Embeddings (Fallback 1)** | OpenAI `text-embedding-3-small` |
| **Embeddings (Fallback 2)** | Custom TF-IDF + character n-grams + cosine similarity |
| **Similarity** | scikit-learn `cosine_similarity`, NumPy |
| **Validation / Errors** | Custom exception hierarchy + FastAPI handlers |
| **Testing** | pytest, pytest-asyncio, FastAPI `TestClient` |
| **Config** | pydantic-settings + `.env` |

---

## 6. System Architecture

*(See `architecture_diagram.md` for the full ASCII/Mermaid diagram.)*

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Recruiter / User                                  │
└─────────────┬───────────────────────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────┐
│          FastAPI Backend         │
│  Routers: jobs / resumes / match │
└───────────────┬──────────────────┘
                │
        ┌───────┴──────────────────────────────┐
        │                                      │
        ▼                                      ▼
 ┌────────────┐                        ┌──────────────────┐
 │  SQLAlchemy│                        │ Service Layer    │
 │   Models   │                        │  - recruitment   │
 │   Job      │                        │  - scoring       │
 │   Candidate│                        │  - document proc │
 │   Match    │                        │  - LLM           │
 └─────┬──────┘                        │  - embedding     │
       │                               └──────┬───────────┘
       ▼                                      │
  ┌──────────────┐                            │
  │   SQLite DB  │                            ▼
  └──────────────┘               ┌───────────────────────┐
                                 │ 3 Backends available:  │
                                 │                        │
                                 │ LLM Service            │
                                 │  • OpenAI GPT          │
                                 │  • Rule-based fallback │
                                 │                        │
                                 │ Embedding Service      │
                                 │  • sentence-transformers│
                                 │  • OpenAI ada          │
                                 │  • TF-IDF fallback     │
                                 └───────────────────────┘
```

---

## 7. Application Workflow

Expected end-to-end flow:

```
Job Description
  │
  ▼
POST /jobs  →  LLM extracts:
   required_skills, nice_to_have_skills,
   min_experience_years, required_education
  │
  ▼
Upload Resumes
POST /resumes (batch)  →  Document Processor:
   validate, extract PDF/DOCX/TXT text
  │
  ▼
LLM extracts structured Candidate Profile:
  name, email, phone, skills, experience_years,
  experience_summary, education[], projects[],
  certifications[], additional_skills[]
  │
  ▼
Embedding Service encodes:
  - each required skill
  - each candidate skill
  - experience / project / education / cert text
  │
  ▼
Semantic Matching Engine:
  cosine similarity + exact-match boost + greedy assignment
  │
  ▼
Scoring Engine (weighted categories 40/25/20/10/5)
  overall_score = Σ wᵢ × scoreᵢ
  │
  ▼
POST /match  →  rank_matches_for_job → assigns rank 1..N
  │
  ▼
GET /ranking/{job_id}
  Skill Gap Analysis + AI-generated Explanation +
  Strengths / Weaknesses bullets → Recruiter Review
```

---

## 8. Resume Processing Approach

File formats handled: **`.pdf`, `.docx`, `.txt`**.

### Flow per file
1. **Validate**
   - Allowed extension check (`ALLOWED_EXTENSIONS`).
   - Max size check (`MAX_UPLOAD_SIZE_MB`).
   - Non-empty byte content.
2. **Persist** to `UPLOAD_DIR` with a content-hash prefix (avoids overwrites).
3. **Extract text**
   - PDF → `pdfplumber` per-page text; catches encrypted / corrupted PDFs.
   - DOCX → `python-docx` paragraphs + tables.
   - TXT → standard `open()` with UTF-8 (fallback to `errors='replace'`).
4. **Clean text**: collapse whitespace, normalize newlines.
5. **Validate content**
   - Minimum 20 characters of text; otherwise `EmptyDocumentError`.
   - PDFs with < 50 chars ⇒ warning that it may be scanned image.
   - > 1M chars ⇒ `DocumentProcessingError`.
6. **Parse into structured candidate profile** via `LLMService.extract_candidate_profile()`
   (LLM path first, rule-based fallback if no API key).

---

## 9. LLM Usage

`LLMService` (`app/services/llm_service.py`) uses OpenAI when `OPENAI_API_KEY` is set; otherwise it uses a robust rule-based fallback, so the application remains fully functional **without any API keys**.

### Tasks delegated to the LLM
| Task | Input | Structured JSON Output |
|------|-------|------------------------|
| JD requirement extraction | `title` + `description` | `required_skills[]`, `nice_to_have_skills[]`, `min_experience_years`, `required_education`, `requirements_summary` |
| Candidate profile extraction | Resume text (chunked if long) | `name`, `email`, `phone`, `skills[]`, `experience_years`, `experience_summary`, `education[]`, `projects[]`, `certifications[]`, `additional_skills[]` |
| Explanation generation | Job + candidate + scores + gap + preliminary bullets | `explanation`, `strengths[]`, `weaknesses[]` |

### Fallback behavior
When `OPENAI_API_KEY` is blank:
- Skill extraction uses a curated dictionary of ~90 common skills + regex scanning.
- Experience is extracted from patterns like `"5+ years"` and `"2019–Present"` date spans.
- Education is detected from degree keywords per resume line.
- Explanation, strengths, and weaknesses are assembled via heuristics.

This guarantees the platform is always demo-able.

---

## 10. Embedding Approach

`EmbeddingService` (`app/services/embedding_service.py`) exposes a single interface with **three backend cascades**:

1. **Local sentence-transformers** (default, recommended): `all-MiniLM-L6-v2`
   - 384-dim embeddings, offline, fast on CPU.
2. **OpenAI** embeddings: `text-embedding-3-small` (1536-dim).
3. **TF-IDF + character n-gram fallback**: zero-dependency, vocabulary built from 150+ recruitment domain terms.

All three backends return unit-normalized vectors, so `cosine_similarity` is consistent.

### Semantic matching primitives used by scoring
- `semantic_similarity(a, b)` → scalar similarity in `[0, 1]`.
- `semantic_match_many(query, candidates, threshold)` → ranked matches.
- `match_skill_lists(required, candidate)` → greedy best-match assignment with exact-match boost.
- `semantic_text_overlap_score(paragraph, candidate_text)` → for experience / project / education free-form overlap.

---

## 11. Matching Methodology

Matching is **not based on string equality**:

1. Both required skills and candidate skills are **embedded**.
2. Pairwise cosine similarity is computed.
3. A **greedy best-first assignment** pairs each required skill with at most one candidate skill, maximising the total similarity.
4. Exact normalized-skill match (case / punctuation / whitespace invariant) → boosted to 1.0.
5. Threshold ≥ 0.68 → counted as *matched*; 0.3–0.68 → partial (weak) match; below that → missing.
6. The same embedding/similarity pipeline is reused for *experience blurbs*, *project descriptions*, *education*, and *certifications*.

This correctly recognises relationships like:
> JD: *"Python backend development experience"* ↔ Resume: *"Developed REST APIs using Python, FastAPI and Django"*.

---

## 12. Scoring Methodology

Five weighted categories. Default weights are **configurable via `.env`**.

| Category | Default Weight | Calculation |
|----------|---------------|-------------|
| Required Skills | 40% | Mean best semantic match across all required skills × 100 |
| Relevant Experience | 25% | Candidate yrs ÷ Min yrs ratio (capped / graduated) + semantic overlap of experience blurb × 25% |
| Projects | 20% | Top-5 weighted semantic overlap of project texts vs requirements + quantity bonus |
| Education / Certs | 10% | Degree-level points + required-education match + cert count + cert relevance bonus |
| Additional Skills | 5% | Mean semantic match of nice-to-have vs candidate / additional skills |

Category scores are 0–100.

```
overall_score = Σ wᵢ × scoreᵢ / Σ wᵢ    (wᵢ from .env)
```

**Weights used by the code** can be retrieved at runtime:

```bash
curl http://localhost:8000/info | jq .scoring_weights
```

---

## 13. API Documentation

| Method | Path | Purpose |
|--------|------|---------|
| `GET`  | `/` | Root metadata / links to docs |
| `GET`  | `/health` | Liveness check |
| `GET`  | `/info` | Embedding backend, LLM status, scoring weights, limits |
| `POST` | `/jobs` | Create a job + extract requirements (body: `JobCreate`) |
| `GET`  | `/jobs` | List jobs, paginated |
| `GET`  | `/jobs/{id}` | Get one job with extracted requirements |
| `POST` | `/jobs/{id}/re-extract` | Re-run requirement extraction |
| `POST` | `/resumes` | Batch-upload resumes for a job (`multipart/form-data`: `job_id` + one or more `files`) |
| `GET`  | `/candidates` | List candidates (filter by `job_id`) |
| `GET`  | `/candidates/{id}` | One candidate with structured profile |
| `POST` | `/match` | Run scoring + ranking for a job (body: `{job_id, candidate_ids?, rerun?}`) |
| `GET`  | `/ranking/{job_id}` | Read computed ranking with scores, skill gaps, AI explanations |

Full OpenAPI schemas (try-it-out) are available at:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Example: end-to-end using curl

```bash
# 1. Create a job
JOB=$(curl -s -X POST localhost:8000/jobs \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Senior Python Backend Engineer",
    "description": "5+ years Python, FastAPI, PostgreSQL, Docker, AWS, REST API. Degree required."
  }')
JOB_ID=$(echo $JOB | jq .id)

# 2. Upload a resume (batch)
curl -s -X POST localhost:8000/resumes \
  -F "job_id=$JOB_ID" \
  -F "files=@./samples/resumes/aarav_sharma_high_match.txt" \
  -F "files=@./samples/resumes/priya_verma_low_match.txt"

# 3. Run matching
curl -s -X POST localhost:8000/match \
  -H 'Content-Type: application/json' \
  -d "{\"job_id\":$JOB_ID,\"rerun\":true}"

# 4. View ranking with explanations
curl -s localhost:8000/ranking/$JOB_ID | jq
```

---

## 14. Installation

### Prerequisites
- Python 3.10+
- Recommended: 8 GB RAM for local sentence-transformers.
- (Optional) An OpenAI API key for higher-quality extraction / explanations.

### Steps

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
# source .venv/bin/activate

pip install -r requirements.txt

# Copy env template and edit
cp .env.example .env
# (set OPENAI_API_KEY if you have one; else the system runs on fallback)

python -m app.main
```

Then open http://localhost:8000/docs

---

## 15. Environment Variables

See `.env.example`. Key variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | SQLAlchemy URL (default `sqlite:///./recruitment.db`) |
| `OPENAI_API_KEY` | OpenAI key. Blank ⇒ use fallback extractors. |
| `OPENAI_MODEL` | Chat model (default `gpt-3.5-turbo`) |
| `OPENAI_EMBEDDING_MODEL` | OpenAI embedding model (default `text-embedding-3-small`) |
| `USE_LOCAL_EMBEDDINGS` | Use sentence-transformers offline (default `true`) |
| `LOCAL_EMBEDDING_MODEL` | sentence-transformer model (default `all-MiniLM-L6-v2`) |
| `UPLOAD_DIR` | Where to store uploads (default `./uploads`) |
| `MAX_UPLOAD_SIZE_MB` | Per-file cap (default 15 MB) |
| `ALLOWED_EXTENSIONS` | `.pdf,.docx,.txt` |
| `WEIGHT_REQUIRED_SKILLS` / `WEIGHT_EXPERIENCE` / `WEIGHT_PROJECTS` / `WEIGHT_EDUCATION_CERT` / `WEIGHT_ADDITIONAL_SKILLS` | Scoring weights (must sum to 100 for interpretability) |

---

## 16. Running Instructions

### Dev mode (auto-reload)
```bash
cd backend
python -m app.main
```

### Production-ish
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2
```

### Verify the system works
```bash
curl localhost:8000/health
# {"status":"ok", ...}

curl localhost:8000/info
# shows embedding_backend, llm_available, scoring_weights, ...
```

---

## 17. Testing

From `backend/`:

```bash
pytest -q
```

The suite **does not require an API key**; the `conftest.py` forces rule-based fallback so tests are fully reproducible offline.

### Coverage summary

| Test file | What it covers |
|-----------|----------------|
| `tests/test_document_processor.py` | PDF/DOCX/TXT extraction, empty/corrupt/unsupported handling |
| `tests/test_llm_service.py` | Job requirement extraction, candidate extraction, explanation generation (fallback mode) |
| `tests/test_embedding_service.py` | Embedding shape, normalization, exact match, semantic ordering vs unrelated text, skill-list greedy matching |
| `tests/test_scoring_service.py` | Weights sum to 100, strong > mediocre > weak candidates, semantic-match resume scores high, ranking order correct, skill gaps surface critical missing skills |
| `tests/test_api.py` | Full end-to-end API workflow with TestClient (create job → 3 resumes → match → rank → skill gaps/explanations), plus 404/validation/empty-file/unsupported-format error paths |

For the detailed scenario list see `../TEST_CASES.md`.

---

## 18. Error Handling

All failures raise typed subclasses of `RecruitmentError` defined in `app/utils/exceptions.py`. The central handler (`app/utils/error_handlers.py`) converts them to a consistent JSON shape:

```json
{ "detail": "Human-readable message", "code": "machine_readable_code" }
```

### Major categories

| Scenario | Exception class | HTTP status | `code` |
|----------|-----------------|-------------|--------|
| Unknown file extension | `UnsupportedFileFormatError` | 400 | `unsupported_file_format` |
| File > 15 MB | `FileTooLargeError` | 413 | `file_too_large` |
| Empty document / scanned PDF with no text | `EmptyDocumentError` | 400 | `empty_document` |
| Corrupted / encrypted PDF or DOCX | `CorruptedDocumentError` | 422 | `corrupted_document` |
| Resume could not extract anything meaningful | `InvalidResumeError` | 422 | `invalid_resume` |
| Generic PDF/DOCX parse error | `DocumentProcessingError` | 500 | `document_processing_failed` |
| Requested Job / Candidate id missing | `JobNotFoundError` / `CandidateNotFoundError` | 404 | `job_not_found` / `candidate_not_found` |
| Empty JD / title | `MissingJobDescriptionError` | 400 | `missing_job_description` |
| Resume text too short | `MissingCandidateInformationError` | 400 | `missing_candidate_information` |
| OpenAI unreachable / rate-limited | `LLMServiceError` | 502 | `llm_service_failed` |
| LLM returned non-JSON | `LLMResponseParseError` | 502 | `llm_response_parse_failed` |
| Embedding backend failure | `EmbeddingServiceError` | 502 | `embedding_service_failed` |
| No candidates for a job at `/match` | `NoCandidatesError` | 400 | `no_candidates` |
| `/ranking` called before `/match` | `NoMatchResultsError` | 404 | `no_match_results` |
| Pydantic validation failure | `RequestValidationError` handler | 422 | `validation_error` |
| Any unhandled exception | generic handler | 500 | `internal_server_error` |

Where possible, the code degrades gracefully instead of crashing:
- Missing OpenAI key ⇒ use rule-based fallback extraction.
- LLM returns malformed JSON ⇒ regex-capture first JSON object, else fallback.
- Local sentence-transformers not installed ⇒ OpenAI embeddings ⇒ TF-IDF fallback.

---

## 19. Known Limitations

1. **Resume extraction accuracy** of rule-based fallback depends on format regularity. The LLM path is significantly more accurate.
2. **Scanned / image-only PDFs** are not OCR'd. The system warns via `EmptyDocumentError` with a helpful message.
3. **Local embeddings** (`all-MiniLM-L6-v2`) are general-purpose and may have subtle biases on niche skills. Fine-tuning or switching to `all-mpnet-base-v2` improves accuracy at the cost of speed.
4. SQLite is used for simplicity. For production with many concurrent match runs, swap to PostgreSQL.
5. The current backend is **API-only**; no Web UI is included. Swagger UI serves as the demo-able GUI.

---

## 20. Future Improvements

- **Frontend**: React + premium gaming/Cyberpunk aesthetic as per UX preference.
- **Authentication & RBAC**: OAuth2/JWT login for recruiter / admin roles.
- **OCR pipeline** for scanned resumes (Tesseract or AWS Textract fallback).
- **Vector DB persistence** (Chroma / pgvector) so embeddings are reused across runs.
- **Asynchronous workers** (Celery / RQ) + WebSocket progress for bulk matching on 1000s of resumes.
- **Fine-tuned extraction**: distil a small LLM on labeled resumes for better offline quality.
- **Multi-round interviews**: store recruiter feedback and re-weight scoring (active learning).
- **Multi-language resumes**: add spaCy language detection and multi-lingual sentence-transformer models.
- **Anonymization mode**: auto-strip name/gender/photo indicators for bias-aware screening.

---

## Repository layout

```
Final Project/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI entry point
│   │   ├── config.py                # pydantic settings
│   │   ├── database.py              # SQLAlchemy engine + Session
│   │   ├── models/models.py         # Job / Candidate / MatchResult
│   │   ├── schemas/schemas.py       # Pydantic request / response
│   │   ├── routers/                 # jobs, resumes, matching, health
│   │   ├── services/
│   │   │   ├── document_processor.py
│   │   │   ├── llm_service.py
│   │   │   ├── embedding_service.py
│   │   │   ├── scoring_service.py
│   │   │   └── recruitment_service.py
│   │   └── utils/
│   │       ├── exceptions.py
│   │       ├── error_handlers.py
│   │       └── file_utils.py
│   ├── tests/                       # pytest suite (~6 files)
│   ├── requirements.txt
│   └── .env.example
├── samples/
│   ├── job_descriptions/
│   └── resumes/
├── architecture_diagram.md
├── TEST_CASES.md
└── README.md
```

Good luck, and enjoy!
