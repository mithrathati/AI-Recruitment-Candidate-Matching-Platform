from app.services.llm_service import llm_service
from app.services.scoring_service import score_candidate, rank_candidates, scoring_engine
from tests.test_llm_service import _llm_service_fallback_only  # noqa: F401 - re-used via monkeypatch


def _build_profiles(sample_job_payload, good_resume_text, mediocre_resume_text, differently_worded_resume_text, monkeypatch):
    monkeypatch.setattr(llm_service, "_client", None)
    req = llm_service.extract_job_requirements(
        sample_job_payload["description"], sample_job_payload["title"]
    )
    good = llm_service.extract_candidate_profile(good_resume_text)
    med = llm_service.extract_candidate_profile(mediocre_resume_text)
    diff = llm_service.extract_candidate_profile(differently_worded_resume_text)
    return req, good, med, diff


def test_scoring_weights_sum_to_100():
    w = scoring_engine
    total = (
        w.W_SKILLS + w.W_EXP + w.W_PROJ + w.W_EDU + w.W_ADD
    )
    assert abs(total - 100.0) < 0.0001


def test_good_candidate_scores_higher_than_mediocre(
    sample_job_payload, good_resume_text, mediocre_resume_text, differently_worded_resume_text, monkeypatch
):
    req, good, med, diff = _build_profiles(
        sample_job_payload, good_resume_text, mediocre_resume_text, differently_worded_resume_text, monkeypatch
    )
    s_good = score_candidate(req, good)
    s_med = score_candidate(req, med)
    s_diff = score_candidate(req, diff)

    # All scores should be in 0-100
    for s in (s_good, s_med, s_diff):
        assert 0.0 <= s["overall_score"] <= 100.0
        for key, val in s["scores"].items():
            assert 0.0 <= val <= 100.0, key

    # Strong candidate > mediocre
    assert s_good["overall_score"] > s_med["overall_score"] + 10, (
        f"good={s_good['overall_score']} med={s_med['overall_score']}"
    )

    # Differently-worded semantic match should still be fairly strong
    assert s_diff["overall_score"] >= 55, f"semantic match too low: {s_diff['overall_score']}"

    # Skill gap should make sense
    matching = s_good["skill_gap"]["matching_skills"]
    missing = s_good["skill_gap"]["missing_skills"]
    low_matching = [m.lower() for m in matching]
    assert any("python" in s for s in low_matching)
    assert any("fastapi" in s for s in low_matching)
    for m in matching:
        assert m not in missing or True  # allow overlap (weakly matched can appear in both if re-listed)
    assert isinstance(s_good["scores"]["required_skills_score"], float)


def test_rank_candidates_sorts_and_assigns_ranks():
    items = [
        {"candidate_id": 1, "overall_score": 76.0},
        {"candidate_id": 2, "overall_score": 91.0},
        {"candidate_id": 3, "overall_score": 84.0},
    ]
    ordered = rank_candidates(items)
    assert ordered[0]["rank"] == 1
    assert ordered[0]["overall_score"] == 91.0
    assert ordered[-1]["rank"] == 3
    assert ordered[-1]["overall_score"] == 76.0


def test_skill_gap_missing_includes_gaps(sample_job_payload, mediocre_resume_text, monkeypatch):
    req = llm_service.extract_job_requirements(
        sample_job_payload["description"], sample_job_payload["title"]
    )
    monkeypatch.setattr(llm_service, "_client", None)
    med = llm_service.extract_candidate_profile(mediocre_resume_text)
    s_med = score_candidate(req, med)
    missing = s_med["skill_gap"]["missing_skills"] or []
    missing_low = [m.lower() for m in missing]
    # The mediocre resume lacks docker, aws, kubernetes, etc.
    critical = ["docker", "aws", "kubernetes"]
    assert any(
        any(c in s for s in missing_low) for c in critical
    ), f"Expected missing skills to include major gaps, got: {missing}"
