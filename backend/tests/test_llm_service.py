from app.services.llm_service import llm_service


def _llm_service_fallback_only(monkeypatch):
    monkeypatch.setattr(llm_service, "_client", None)
    return llm_service


def test_extract_job_requirements_fallback_populates_skills_and_exp(monkeypatch, sample_job_payload):
    svc = _llm_service_fallback_only(monkeypatch)
    out = svc.extract_job_requirements(
        sample_job_payload["description"], sample_job_payload["title"]
    )
    assert isinstance(out["required_skills"], list)
    # Should have extracted meaningful skills from the JD
    req = [s.lower() for s in out["required_skills"]]
    assert any("python" in s for s in req)
    assert any("fastapi" in s for s in req)
    assert out["min_experience_years"] is not None
    assert out["min_experience_years"] >= 5


def test_extract_candidate_profile_fallback(good_resume_text, monkeypatch):
    svc = _llm_service_fallback_only(monkeypatch)
    p = svc.extract_candidate_profile(good_resume_text)
    assert p.get("name") or p.get("skills")
    assert isinstance(p["skills"], list)
    low = [s.lower() for s in p["skills"]]
    assert any("python" in s for s in low)
    assert any("fastapi" in s for s in low)
    assert p["experience_years"] is not None and p["experience_years"] >= 5
    assert len(p["education"]) > 0


def test_generate_explanation_fallback_produces_text(sample_job_payload, good_resume_text, monkeypatch):
    svc = _llm_service_fallback_only(monkeypatch)
    req = svc.extract_job_requirements(
        sample_job_payload["description"], sample_job_payload["title"]
    )
    prof = svc.extract_candidate_profile(good_resume_text)
    explanation, strengths, weaknesses = svc.generate_explanation(
        job_title=sample_job_payload["title"],
        job_req=req,
        candidate_name=prof.get("name") or "Candidate",
        profile=prof,
        scores={"required_skills_score": 85.0, "experience_score": 90.0,
                "projects_score": 75.0, "education_cert_score": 80.0,
                "additional_skills_score": 50.0},
        matching_skills=req["required_skills"][:3],
        missing_skills=req["required_skills"][-2:],
        strengths=[],
        weaknesses=[],
        overall_score=83.5,
    )
    assert isinstance(explanation, str) and len(explanation) > 30
    assert isinstance(strengths, list) and len(strengths) > 0
    assert isinstance(weaknesses, list)
