from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import Job
from app.schemas.schemas import (
    JobCreate,
    JobResponse,
    JobListResponse,
    JobRequirementExtract,
)
from app.services.recruitment_service import extract_and_persist_job_requirements
from app.utils.exceptions import JobNotFoundError

router = APIRouter(prefix="/jobs", tags=["Jobs"])


@router.post("", response_model=JobResponse, status_code=201)
def create_job(payload: JobCreate, db: Session = Depends(get_db)):
    job = Job(title=payload.title, description=payload.description)
    db.add(job)
    db.commit()
    db.refresh(job)
    try:
        job = extract_and_persist_job_requirements(db, job)
    except Exception:
        # Fall back: return the job without failing the entire request
        db.refresh(job)
    return _to_response(job)


@router.get("", response_model=JobListResponse)
def list_jobs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(Job)
    total = q.count()
    rows = q.order_by(Job.created_at.desc()).offset(skip).limit(limit).all()
    return JobListResponse(jobs=[_to_response(j) for j in rows], total=total)


@router.get("/{job_id}", response_model=JobResponse)
def get_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise JobNotFoundError(f"Job {job_id} not found.")
    return _to_response(job)


@router.post("/{job_id}/re-extract", response_model=JobResponse)
def re_extract_requirements(job_id: int, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise JobNotFoundError(f"Job {job_id} not found.")
    job = extract_and_persist_job_requirements(db, job)
    return _to_response(job)


def _to_response(job: Job) -> JobResponse:
    req = None
    if job.requirements or job.required_skills or job.required_education:
        req = JobRequirementExtract(
            required_skills=job.required_skills or [],
            nice_to_have_skills=job.nice_to_have_skills or [],
            min_experience_years=job.min_experience_years,
            required_education=job.required_education,
            requirements_summary=(job.requirements or {}).get("requirements_summary"),
        )
    return JobResponse(
        id=job.id,
        title=job.title,
        description=job.description,
        requirements=req,
        required_skills=job.required_skills,
        nice_to_have_skills=job.nice_to_have_skills,
        min_experience_years=job.min_experience_years,
        required_education=job.required_education,
        created_at=job.created_at,
    )
