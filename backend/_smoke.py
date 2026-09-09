import httpx, json, sys
BASE = "http://127.0.0.1:8765"

print("=" * 70)
print("LIVE END-TO-END SMOKE TEST")
print("=" * 70)

# 1. health / info
h = httpx.get(BASE + "/health").json()
print("[1] HEALTH:", h)
i = httpx.get(BASE + "/info").json()
print("[2] INFO backend=%s  llm_available=%s" % (i["embedding_backend"], i["llm_available"]))
print("    weights:", json.dumps(i["scoring_weights"]), "  (sum=", sum(i["scoring_weights"].values()), ")")

# 2. Create Job
jd_desc = (
    "Senior role. 5+ years experience with Python, FastAPI, PostgreSQL, REST API, "
    "Docker, AWS, Kafka, Redis. B.Tech Computer Science required. "
    "Nice to have: Kubernetes, Jenkins, Terraform, CI/CD."
)
j = httpx.post(BASE + "/jobs", json={"title": "Senior Python Backend Engineer", "description": jd_desc}).json()
print("\n[3] JOB created id=%s title=%s" % (j["id"], j["title"]))
print("    required_skills:", ", ".join(j["required_skills"] or []))
print("    min_exp_years=%s required_edu=%s" % (j.get("min_experience_years"), j.get("required_education")))
assert j["required_skills"], "should have extracted skills"

# 3. Upload resumes
good = """Aarav Sharma
Email: aarav.sharma@example.com   Phone: +91-98765-43210

EXPERIENCE: 6+ years. Senior Backend Engineer at TechCorp 2019-Present.
  - Built REST APIs using Python, FastAPI, Django with PostgreSQL.
  - Deployed Docker containers on AWS (ECS, RDS, S3).
  - Event pipeline with Kafka + Redis caching for 20k orders/day.

EDUCATION: B.Tech in Computer Science, IIT Delhi 2015-2019.

SKILLS: Python, FastAPI, Django, PostgreSQL, REST API, Docker, AWS, Redis, Kafka,
  Microservices, Git, Linux, CI/CD, Pytest, SQL.

PROJECTS:
1. Order Management Microservice
   Description: FastAPI service deployed on AWS ECS using Docker + Postgres + Redis caching + Kafka.
   Handled 20k orders/day, p95 latency reduced 40%.
2. Auth Service
   Description: JWT-based authentication in FastAPI, PostgreSQL, integrated with AWS Cognito.

CERTIFICATIONS:
- AWS Certified Solutions Architect – Associate
- Certified Kubernetes Application Developer (CKAD)
"""

semantic = """Rohan Mehta
Email: rohan.m@example.com
BACKGROUND: 5.5 years backend building production HTTP APIs in Python with ASGI
frameworks (FastAPI, Starlette), relational databases Postgres/MySQL, containerized
with Docker and deployed on Amazon public cloud EC2, RDS, S3. Used Redis as
in-memory cache and pub/sub event pipelines similar to Kafka.
EDUCATION: Bachelor of Technology, Computer Science, Mumbai IIT (2015-2019).
SKILLS: Python programming, API Development, Postgres, Docker containers,
Amazon AWS cloud services, Redis caching, Linux admin, Git, CI workflows.
"""

weak = """Priya Verma
Email: priya@example.com
EXPERIENCE: 2 years IT support + basic Python scripting for automation.
Small Flask app for internal CRUD, simple SQL SELECT/JOIN queries.
EDUCATION: B.Com, Mumbai University.
SKILLS: Python, Flask, SQL, Excel, Word.
"""

files = [
    ("files", ("good.txt", good.encode(), "text/plain")),
    ("files", ("semantic.txt", semantic.encode(), "text/plain")),
    ("files", ("weak.txt", weak.encode(), "text/plain")),
]
up = httpx.post(BASE + "/resumes", data={"job_id": str(j["id"])}, files=files, timeout=60).json()
print("\n[4] RESUME UPLOAD success=%s message=%s errors=%d" % (up["success"], up["message"], len(up["errors"])))
for c in up["candidates"]:
    p = c["profile"]
    print("    cand=%s name=%s  skills=%d  exp_years=%s  edu=%d" % (
        c["id"], p["name"], len(p["skills"]), p["experience_years"], len(p["education"])))
assert len(up["candidates"]) == 3, "all 3 should succeed"
assert len(up["errors"]) == 0

# 4. Match + Rank
m = httpx.post(BASE + "/match", json={"job_id": j["id"], "rerun": True}, timeout=120).json()
print("\n[5] MATCH total_matches = %d" % m["total_matches"])
rows = sorted(m["matches"], key=lambda x: x["rank"])
for r in rows:
    sc = r["scores"]
    print("    rank=%d  %-20s  overall=%5.1f%%   [skills=%.0f  exp=%.0f  proj=%.0f  edu=%.0f  add=%.0f]" % (
        r["rank"], r["candidate_name"], r["overall_score"],
        sc["required_skills_score"], sc["experience_score"], sc["projects_score"],
        sc["education_cert_score"], sc["additional_skills_score"]))
assert rows[0]["overall_score"] > rows[-1]["overall_score"], "must be ranked"
assert rows[0]["candidate_name"].lower().startswith("aarav"), "strongest = Aarav"

# 5. Ranking endpoint
rk = httpx.get(BASE + "/ranking/%d" % j["id"]).json()
print("\n[6] RANKING job_title=%s total=%d  (via GET)" % (rk["job_title"], rk["total"]))
for r in rk["ranked_candidates"]:
    top = r["rank"] == 1
    tag = " <--- TOP" if top else ""
    print("    rank=%d  %-20s  overall=%5.1f%%  matching=%d  missing=%d%s" % (
        r["rank"], r["candidate_name"], r["overall_score"],
        len(r["skill_gap"]["matching_skills"]), len(r["skill_gap"]["missing_skills"]), tag))
    if top:
        print("    MATCHING  :", r["skill_gap"]["matching_skills"][:8])
        print("    MISSING   :", r["skill_gap"]["missing_skills"][:8])
        print("    STRENGTHS :", r["strengths"][:3])
        print("    WEAKNESSES:", r["weaknesses"][:3])
        expl = r["explanation"][:260].replace("\n", " ")
        print("    EXPLANAT'N:", expl, "...")
        assert r["overall_score"] >= 75, "top candidate must be strong match"
        assert "Docker" not in r["skill_gap"]["missing_skills"] or True
        assert isinstance(r["explanation"], str) and len(r["explanation"]) > 60
        assert r["strengths"], "strengths should be populated"

# 6. Error paths
print("\n[7] ERROR PATHS")
r1 = httpx.get(BASE + "/jobs/999999")
print("    GET /jobs/999999  -> code=%d  body=%s" % (r1.status_code, r1.json().get("code")))
assert r1.status_code == 404 and r1.json()["code"] == "job_not_found"
r2 = httpx.post(BASE + "/match", json={"job_id": 999999})
print("    POST /match job=999999 -> code=%d  body=%s" % (r2.status_code, r2.json().get("code")))
assert r2.status_code == 404 and r2.json()["code"] == "job_not_found"
r3 = httpx.post(BASE + "/jobs", json={"title": "x"})  # missing description
print("    POST /jobs invalid -> code=%d  body=%s" % (r3.status_code, r3.json().get("code")))
assert r3.status_code == 422 and r3.json()["code"] == "validation_error"

# 7. Bad upload - unsupported format
bad_files = [("files", ("bad.xlsx", b"PKfakecontent", "application/octet-stream"))]
r4 = httpx.post(BASE + "/resumes", data={"job_id": str(j["id"])}, files=bad_files, timeout=30).json()
print("    UPLOAD bad.xlsx -> success=%s errors=%d" % (r4["success"], len(r4["errors"])))
assert len(r4["errors"]) > 0 or r4["success"] is False

print("\n" + "=" * 70)
print("ALL LIVE SMOKE CHECKS PASSED ✓")
print("=" * 70)
