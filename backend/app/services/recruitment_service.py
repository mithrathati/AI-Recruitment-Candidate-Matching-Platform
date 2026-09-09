from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.models import Job, Candidate, MatchResult
from app.services.llm_service import llm_service
from app.services.scoring_service import score_candidate, rank_candidates
from app.utils.exceptions import (
    JobNotFoundError,
    CandidateNotFoundError,
    NoCandidatesError,
    NoMatchResultsError,
    InvalidInputError,
)


def _job_to_req_dict(job: Job) -> Dict[str, Any]:
    return {
        "required_skills": job.required_skills or [],
        "nice_to_have_skills": job.nice_to_have_skills or [],
        "min_experience_years": job.min_experience_years,
        "required_education": job.required_education,
        "requirements_summary": None,
    }


def _candidate_to_profile_dict(cand: Candidate) -> Dict[str, Any]:
    return {
        "name": cand.name,
        "email": cand.email,
        "phone": cand.phone,
        "skills": cand.skills or [],
        "experience_years": cand.experience_years,
        "experience_summary": cand.experience_summary,
        "education": cand.education or [],
        "projects": cand.projects or [],
        "certifications": cand.certifications or [],
        "additional_skills": cand.additional_skills or [],
    }


def extract_and_persist_job_requirements(db: Session, job: Job) -> Job:
    extracted = llm_service.extract_job_requirements(job.description, job.title)
    job.required_skills = extracted["required_skills"]
    job.nice_to_have_skills = extracted["nice_to_have_skills"]
    job.min_experience_years = extracted["min_experience_years"]
    job.required_education = extracted["required_education"]
    job.requirements = {
        "requirements_summary": extracted["requirements_summary"],
    }
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def extract_and_persist_candidate_profile(db: Session, cand: Candidate) -> Candidate:
    profile = llm_service.extract_candidate_profile(cand.resume_text)
    cand.name = profile.get("name")
    cand.email = profile.get("email")
    cand.phone = profile.get("phone")
    cand.skills = profile.get("skills") or []
    cand.experience_years = profile.get("experience_years")
    cand.experience_summary = profile.get("experience_summary")
    cand.education = profile.get("education") or []
    cand.projects = profile.get("projects") or []
    cand.certifications = profile.get("certifications") or []
    cand.additional_skills = profile.get("additional_skills") or []
    db.add(cand)
    db.commit()
    db.refresh(cand)
    return cand


def run_matching_for_job(
    db: Session,
    job_id: int,
    candidate_ids: Optional[List[int]] = None,
    rerun: bool = False,
) -> List[Dict[str, Any]]:
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise JobNotFoundError(f"Job with id {job_id} not found.")

    candidates_q = db.query(Candidate).filter(Candidate.job_id == job_id)
    if candidate_ids:
        candidates_q = candidates_q.filter(Candidate.id.in_(candidate_ids))
    candidates = candidates_q.all()

    if not candidates:
        raise NoCandidatesError(
            "No candidates found for this job. Upload resumes before running matching."
        )

    # Ensure requirements extracted
    if not job.required_skills or rerun:
        job = extract_and_persist_job_requirements(db, job)

    job_req = _job_to_req_dict(job)
    results: List[Dict[str, Any]] = []

    for cand in candidates:
        # Ensure candidate profile extracted
        if not cand.skills or rerun:
            cand = extract_and_persist_candidate_profile(db, cand)
        profile = _candidate_to_profile_dict(cand)

        # Scoring (embeddings + semantic matching)
        scored = score_candidate(job_req, profile)

        # LLM explanation & refined strengths/weaknesses
        explanation, strengths, weaknesses = llm_service.generate_explanation(
            job_title=job.title,
            job_req=job_req,
            candidate_name=cand.name or "Candidate",
            profile=profile,
            scores=scored["scores"],
            matching_skills=scored["skill_gap"]["matching_skills"],
            missing_skills=scored["skill_gap"]["missing_skills"],
            strengths=[],
            weaknesses=[],
            overall_score=scored["overall_score"],
        )

        # Persist match
        mr = db.query(MatchResult).filter(MatchResult.candidate_id == cand.id).first()
        if mr is None:
            mr = MatchResult(job_id=job.id, candidate_id=cand.id)

        mr.overall_score = scored["overall_score"]
        mr.required_skills_score = scored["scores"]["required_skills_score"]
        mr.experience_score = scored["scores"]["experience_score"]
        mr.projects_score = scored["scores"]["projects_score"]
        mr.education_cert_score = scored["scores"]["education_cert_score"]
        mr.additional_skills_score = scored["scores"]["additional_skills_score"]
        mr.matching_skills = scored["skill_gap"]["matching_skills"]
        mr.missing_skills = scored["skill_gap"]["missing_skills"]
        mr.strengths = strengths
        mr.weaknesses = weaknesses
        mr.explanation = explanation
        db.add(mr)
        db.commit()
        db.refresh(mr)

        results.append({
            "match_id": mr.id,
            "job_id": job.id,
            "candidate_id": cand.id,
            "candidate_name": cand.name,
            "overall_score": mr.overall_score,
            "scores": {
                "required_skills_score": mr.required_skills_score,
                "experience_score": mr.experience_score,
                "projects_score": mr.projects_score,
                "education_cert_score": mr.education_cert_score,
                "additional_skills_score": mr.additional_skills_score,
            },
            "skill_gap": {
                "matching_skills": mr.matching_skills or [],
                "missing_skills": mr.missing_skills or [],
            },
            "strengths": mr.strengths or [],
            "weaknesses": mr.weaknesses or [],
            "explanation": mr.explanation,
        })

    # Compute ranks based on persisted scores across all candidates for the job
    rank_matches_for_job(db, job_id)

    for r in results:
        mr_refresh = db.query(MatchResult).filter(MatchResult.candidate_id == r["candidate_id"]).first()
        if mr_refresh is not None:
            r["rank"] = mr_refresh.rank

    return results


def rank_matches_for_job(db: Session, job_id: int) -> List[MatchResult]:
    matches = db.query(MatchResult).filter(MatchResult.job_id == job_id).all()
    if not matches:
        raise NoMatchResultsError(f"No match results found for job {job_id}. Run /match first.")
    rows = [{"id": m.id, "score": m.overall_score} for m in matches]
    rows_sorted = sorted(rows, key=lambda x: x["score"], reverse=True)
    id_to_rank = {r["id"]: idx + 1 for idx, r in enumerate(rows_sorted)}
    for m in matches:
        m.rank = id_to_rank.get(m.id)
    db.commit()
    return matches


def get_ranking_for_job(db: Session, job_id: int) -> Dict[str, Any]:
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise JobNotFoundError(f"Job {job_id} not found.")
    matches = db.query(MatchResult).filter(MatchResult.job_id == job_id).all()
    if not matches:
        raise NoMatchResultsError(f"No ranking available for job {job_id}. Run /match first.")
    ranked = sorted(matches, key=lambda m: (m.rank if m.rank else 9999, -m.overall_score))
    out_rows = []
    for m in ranked:
        cand = m.candidate
        out_rows.append({
            "candidate_id": cand.id,
            "candidate_name": cand.name if cand else None,
            "overall_score": m.overall_score,
            "scores": {
                "required_skills_score": m.required_skills_score,
                "experience_score": m.experience_score,
                "projects_score": m.projects_score,
                "education_cert_score": m.education_cert_score,
                "additional_skills_score": m.additional_skills_score,
            },
            "skill_gap": {
                "matching_skills": m.matching_skills or [],
                "missing_skills": m.missing_skills or [],
            },
            "strengths": m.strengths or [],
            "weaknesses": m.weaknesses or [],
            "explanation": m.explanation,
            "rank": m.rank,
        })
    return {
        "job_id": job.id,
        "job_title": job.title,
        "ranked_candidates": out_rows,
        "total": len(out_rows),
    }
