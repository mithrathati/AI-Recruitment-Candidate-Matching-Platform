# Test Cases — AI Recruitment Platform

This document lists the **scenario-level test cases**. The automated pytest suite in `backend/tests/` implements the core subset of these. Where manual steps are required, they are listed explicitly.

Legend: **A** = automated (pytest), **M** = manual / demo, **A+M** = both.

---

## 1. Document Processing

| ID | Scenario | Type | Expected Result |
|----|----------|------|-----------------|
| D-1 | Valid `.txt` resume with structured content | A | Text extracted, length ≥ 100 chars, sections preserved. |
| D-2 | Valid `.docx` resume | M | Paragraphs and tables read correctly; no parse crash. |
| D-3 | Valid `.pdf` resume (text-based, not scanned) | M | Multi-page text concatenated correctly. |
| D-4 | Corrupted DOCX / truncated PDF | A | `CorruptedDocumentError` / HTTP 422 `corrupted_document`. |
| D-5 | Encrypted / password-protected PDF | M | Error with "encrypted or corrupted" message. |
| D-6 | File with only whitespace / 2 lines | A | `EmptyDocumentError` / HTTP 400 `empty_document`. |
| D-7 | Scanned-image PDF (no text layer) | M | `EmptyDocumentError` hinting at scanned-image issue. |
| D-8 | Unsupported extension `.xlsx`, `.png` | A+M | `UnsupportedFileFormatError` / HTTP 400. |
| D-9 | File > `MAX_UPLOAD_SIZE_MB` (e.g. 20 MB) | M | `FileTooLargeError` / HTTP 413. |
| D-10 | Long document (> 1M chars) | M | `DocumentProcessingError` with message. |

---

## 2. JD Requirement Extraction

| ID | Scenario | Type | Expected Result |
|----|----------|------|-----------------|
| J-1 | Clear JD with bullet skills | A+M | `required_skills[]` populated correctly; no hallucinated skills. |
| J-2 | JD uses synonyms ("Postgres on Amazon cloud") | M | Semantic equivalent extracted correctly or picked up by embeddings. |
| J-3 | JD with `"5+ years"` experience requirement | A | `min_experience_years == 5.0` (via fallback path). |
| J-4 | JD specifying degree (`B.Tech CS`) | A+M | `required_education` field non-empty. |
| J-5 | Empty / too-short description | A | `MissingJobDescriptionError` / HTTP 400. |
| J-6 | Description missing entirely (Pydantic validation) | A | HTTP 422 `validation_error`. |
| J-7 | Re-extract endpoint `/jobs/{id}/re-extract` | M | Requirements updated deterministically. |

---

## 3. Resume Profile Extraction

| ID | Scenario | Type | Expected Result |
|----|----------|------|-----------------|
| R-1 | Complete, well-formatted tech resume | A+M | Name, email, phone, skills, experience_years, education, projects, certs all populated. |
| R-2 | Resume with weak structure / no sections | M | Fallback path still recovers skills + experience estimate. |
| R-3 | Resume with very little information (only name + 1 skill) | A+M | `MissingCandidateInformationError` warning OR profile with mostly empty lists. |
| R-4 | Different formats (functional / chronological / 1-page) | M | Extraction succeeds without crashes. |
| R-5 | Resume text includes date spans like `"2019 – Present"` | A | Experience years computed from spans. |
| R-6 | Duplicate upload of the same file | M | File names stored with hash prefix; no filesystem collision. |

---

## 4. Embeddings & Semantic Matching

| ID | Scenario | Type | Expected Result |
|----|----------|------|-----------------|
| E-1 | Backend selection: no key, no sent-tf → TF-IDF | A | `/info` returns `"tfidf-fallback"` or equivalent. |
| E-2 | Exact skill match ("Python" vs "Python") | A | Similarity ≥ 0.99. |
| E-3 | Close semantic match (e.g. "REST API" vs "HTTP APIs") | A | Similarity clearly higher than unrelated pair. |
| E-4 | Required skill "PostgreSQL" vs candidate "Postgres" | A+M | Greedy matcher counts it as match. |
| E-5 | Required "AWS" vs "Amazon cloud EC2 RDS S3" | A+M | Match counted; not missed due to different wording. |
| E-6 | Required "Kubernetes" vs no mention at all | A | Listed in missing / low partial score. |
| E-7 | 100+ required skills × 100+ candidate skills | M | Runtime < 2s on average laptop; no OOM. |

---

## 5. Scoring Engine

| ID | Scenario | Type | Expected Result |
|----|----------|------|-----------------|
| S-1 | Weights sum to 100 by default | A | Assert `40+25+20+10+5 == 100`. |
| S-2 | Strong candidate vs Senior Python JD | A | `overall_score >= 80`. |
| S-3 | Mediocre candidate vs same JD | A | `overall_score` at least 10 pts below strong candidate. |
| S-4 | Semantic-match resume (wording differs but tech same) | A | Score >= 55 (demonstrates non-keyword match works). |
| S-5 | Candidate with 1 yr vs JD requiring 5 yrs | A+M | Experience score dragged down meaningfully. |
| S-6 | Candidate with many strong relevant projects vs few | A+M | Projects score differs by at least 20 points. |
| S-7 | Required education B.Tech vs B.Com candidate | M | Education/cert category penalised appropriately. |
| S-8 | All category scores bounded 0–100 | A | Score clamp assertions for all per-category + overall. |
| S-9 | Zero required skills | A | Required skills score default = 100 (not punished). |

---

## 6. Ranking

| ID | Scenario | Type | Expected Result |
|----|----------|------|-----------------|
| RK-1 | 3 candidates with known scores | A | Ranks assigned 1,2,3; descending by score. |
| RK-2 | Rerun `/match` after uploading more candidates | M | Old ranks updated; new rank reflects new ordering. |
| RK-3 | Ties possible (rare) | M | Both get same overall_score; ranks deterministic (DB id tiebreaker). |
| RK-4 | `/ranking` before `/match` | A | `NoMatchResultsError` / 404 with helpful message. |

---

## 7. Skill Gap Analysis & AI Explanation

| ID | Scenario | Type | Expected Result |
|----|----------|------|-----------------|
| G-1 | Strong candidate against Senior Python JD | A+M | ~most required skills in matching[], 0-2 in missing[]. |
| G-2 | Weak candidate (missing Docker, AWS, Kubernetes) | A+M | Those skills appear in missing/weak lists. |
| G-3 | Explanation length | A | ≥ 30 chars; coherent English sentences. |
| G-4 | Strengths / Weaknesses lists non-empty for strong match | A | Both lists populated. |
| G-5 | LLM failure simulated (blank API key) | A | Heuristic fallback explanation still produced; no crash. |
| G-6 | High score → recommendation positive | M | Verdict language: "excellent match", "strong hire". |
| G-7 | Low score → recommendation honest | M | Verdict language: "not a strong match at this time". |

---

## 8. API End-to-End

| ID | Scenario | Type | Expected Result |
|----|----------|------|-----------------|
| API-1 | Health returns 200 | A | `status == "ok"`. |
| API-2 | `/info` returns weights and backend info | A | Valid JSON; weights sum to 100. |
| API-3 | Create job, list jobs, get job by id | A | All 200/201 and consistent ids. |
| API-4 | 404 on nonexistent job/candidate id | A | 404 with correct `code` field. |
| API-5 | Batch-upload 3 resumes to a job | A | 3 candidates persisted, 0 errors in response. |
| API-6 | Batch with 2 good + 1 empty file | A+M | Endpoint returns partial success + per-file errors list. |
| API-7 | Upload resume with wrong `job_id` (nonexistent) | A | 404 `job_not_found`. |
| API-8 | Full e2e: create → upload 3 → match → ranking | A | Ranked 1-2-3; every row contains score breakdown, skill gap, strengths/weaknesses, explanation. |
| API-9 | Invalid JSON body causes 422 | A | Body includes `code == "validation_error"`. |

---

## 9. Error Handling & Resilience

| ID | Scenario | Type | Expected Result |
|----|----------|------|-----------------|
| X-1 | `OPENAI_API_KEY` not set | A+M | App fully functional via rule-based fallback. |
| X-2 | Embedding backend: no sentence-transformers, no API key | A+M | TF-IDF fallback used; `/match` still returns scores. |
| X-3 | Resume processing failure on 1 of N files in batch | A+M | Only the bad file reported in `errors[]`; other candidates still inserted. |
| X-4 | LLM returns malformed JSON | A | Regex-extracts JSON; worst case falls back to rule-based profile. |
| X-5 | LLM service times out or 5xx | M | `LLMServiceError` → 502 JSON; no traceback leaked. |
| X-6 | Malicious file name (path traversal) | M | Saved under sanitized basename; no filesystem escape. |
| X-7 | Simultaneous `/match` calls for same job (double-click) | M | Second run just re-runs (UPSERT-style); no duplicate MatchResult per candidate_id. |
| X-8 | DB missing tables on first run | A+M | `Base.metadata.create_all` creates them on startup. |

---

## 10. Negative / Edge Cases

| ID | Scenario | Type | Expected Result |
|----|----------|------|-----------------|
| N-1 | No candidates → `/match` | A | `NoCandidatesError` / HTTP 400 "upload resumes first". |
| N-2 | Zero required skills (JD extraction failed to find any) | A+M | Required skills score = 100; experience + projects + edu dominate. |
| N-3 | Candidate has no extracted skills (pure fallback miss) | A | 0 score in skills; other categories still run. |
| N-4 | Candidate with 0 projects, 0 certs | A | Projects score = 0; cert/edu portion minimal; no crash. |
| N-5 | Pagination with 0 jobs / 0 candidates | A+M | Returns empty list and `total: 0`; no error. |
| N-6 | Unicode content in resume (Hindi chars, smart quotes, em dashes) | M | Still extracts; no UnicodeEncodeError anywhere. |

---

## 11. Running the Automated Suite

```bash
cd backend
# ensure deps installed
pytest -q
# or for more verbosity + durations:
pytest -v --durations=0
```

Expected: **all tests pass without any API keys or internet** (rule-based fallback paths).
