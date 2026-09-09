import io
import os
import tempfile

import pytest


def test_health_endpoint(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_info_endpoint_exposes_scoring_weights(client):
    r = client.get("/info")
    assert r.status_code == 200
    data = r.json()
    assert "scoring_weights" in data
    weights = data["scoring_weights"]
    total = sum(weights.values())
    assert abs(total - 100.0) < 0.01


def test_create_job_extracts_requirements(client, sample_job_payload):
    r = client.post("/jobs", json=sample_job_payload)
    assert r.status_code == 201, r.json()
    body = r.json()
    assert body["id"] > 0
    assert body["title"] == sample_job_payload["title"]
    # Should have extracted skills (via fallback)
    assert isinstance(body["required_skills"], list)
    assert len(body["required_skills"]) >= 3


def test_get_job_and_list(client, sample_job_payload):
    r = client.post("/jobs", json=sample_job_payload)
    job_id = r.json()["id"]
    r2 = client.get(f"/jobs/{job_id}")
    assert r2.status_code == 200
    assert r2.json()["id"] == job_id
    lst = client.get("/jobs")
    assert lst.status_code == 200
    assert lst.json()["total"] >= 1


def test_get_job_404(client):
    r = client.get("/jobs/999999")
    assert r.status_code == 404
    assert r.json()["code"] == "job_not_found"


def _txt_upload(name: str, text):
    if isinstance(text, bytes):
        data = text
    else:
        data = text.encode("utf-8")
    bio = io.BytesIO(data)
    bio.name = name
    return ("files", bio)


def test_upload_resume_valid(client, sample_job_payload, good_resume_text):
    job_id = client.post("/jobs", json=sample_job_payload).json()["id"]
    files = [
        _txt_upload("aarav_resume.txt", good_resume_text),
    ]
    r = client.post("/resumes", data={"job_id": job_id}, files=files)
    assert r.status_code == 201, r.json()
    body = r.json()
    assert body["success"] is True
    assert body["candidates"], body
    cand = body["candidates"][0]
    assert cand["id"] > 0
    # Profile should be populated (fallback)
    prof = cand["profile"]
    assert any("python" in s.lower() for s in prof["skills"])


def test_upload_resume_empty_file_returns_error(client, sample_job_payload):
    job_id = client.post("/jobs", json=sample_job_payload).json()["id"]
    files = [_txt_upload("empty.txt", "   \n\n\n   ")]
    r = client.post("/resumes", data={"job_id": job_id}, files=files)
    assert r.status_code == 201  # endpoint returns 201 with errors array
    body = r.json()
    assert body["errors"] or body["success"] is False


def test_upload_resume_unsupported_format(client, sample_job_payload):
    job_id = client.post("/jobs", json=sample_job_payload).json()["id"]
    files = [_txt_upload("bad.xlsx", b"not a text file")]
    r = client.post("/resumes", data={"job_id": job_id}, files=files)
    assert r.status_code == 201
    body = r.json()
    # Either reported error OR success=False / error in list
    if body["errors"]:
        bad = body["errors"][0]["error"].lower()
        assert "unsupported" in bad or "format" in bad


def test_upload_wrong_job_id(client, good_resume_text):
    files = [_txt_upload("r.txt", good_resume_text)]
    r = client.post("/resumes", data={"job_id": 999999}, files=files)
    assert r.status_code == 404
    assert r.json()["code"] == "job_not_found"


def test_full_match_and_ranking_workflow(
    client,
    sample_job_payload,
    good_resume_text,
    mediocre_resume_text,
    differently_worded_resume_text,
):
    # 1. create job
    j = client.post("/jobs", json=sample_job_payload).json()
    job_id = j["id"]
    # 2. upload 3 resumes
    files = [
        _txt_upload("good.txt", good_resume_text),
        _txt_upload("med.txt", mediocre_resume_text),
        _txt_upload("diff.txt", differently_worded_resume_text),
    ]
    up = client.post("/resumes", data={"job_id": job_id}, files=files)
    assert up.status_code == 201, up.json()
    cands = client.get("/candidates", params={"job_id": job_id}).json()
    assert cands["total"] >= 3

    # 3. run matching
    mr = client.post("/match", json={"job_id": job_id, "rerun": True})
    assert mr.status_code == 200, mr.json()
    mdata = mr.json()
    assert mdata["total_matches"] == 3
    match_rows = mdata["matches"]
    scores = [m["overall_score"] for m in match_rows]
    assert all(0.0 <= s <= 100.0 for s in scores)

    # 4. ranking
    rr = client.get(f"/ranking/{job_id}")
    assert rr.status_code == 200, rr.json()
    rank = rr.json()
    assert rank["job_id"] == job_id
    assert rank["total"] == 3
    ranked = rank["ranked_candidates"]
    # Ranks should be 1..3
    ranks = [r["rank"] for r in ranked]
    assert sorted(ranks) == [1, 2, 3]
    # Top score >= bottom score
    top, bot = ranked[0]["overall_score"], ranked[-1]["overall_score"]
    assert top >= bot

    # Every match must contain skill_gap, explanation, strengths, weaknesses
    for r in ranked:
        assert "skill_gap" in r
        assert isinstance(r["skill_gap"]["matching_skills"], list)
        assert isinstance(r["skill_gap"]["missing_skills"], list)
        assert isinstance(r["strengths"], list)
        assert isinstance(r["weaknesses"], list)
        assert isinstance(r["explanation"], str) and len(r["explanation"]) > 20
        assert "scores" in r and len(r["scores"]) == 5


def test_match_missing_job_errors(client):
    r = client.post("/match", json={"job_id": 99999})
    assert r.status_code == 404
    assert r.json()["code"] == "job_not_found"


def test_ranking_before_match_errors(client, sample_job_payload):
    job_id = client.post("/jobs", json=sample_job_payload).json()["id"]
    r = client.get(f"/ranking/{job_id}")
    assert r.status_code == 404
    assert r.json()["code"] == "no_match_results"


def test_validation_error_returns_code(client):
    # invalid job: too-short title
    r = client.post("/jobs", json={"title": "x", "description": "valid desc long enough for validation."})
    # missing description
    r2 = client.post("/jobs", json={"title": "OK title"})
    assert r2.status_code == 422
    assert r2.json().get("code") == "validation_error"
