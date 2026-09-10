import os
import re
from io import BytesIO
from typing import List

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import Candidate, Job
from app.schemas.schemas import (
    CandidateProfile,
    CandidateResponse,
    CandidateListResponse,
    CandidateUploadResponse,
)
from app.services.document_processor import (
    extract_document_text,
    validate_document,
)
from app.services.recruitment_service import extract_and_persist_candidate_profile
from app.utils.file_utils import validate_upload
from app.utils.exceptions import (
    JobNotFoundError,
    CandidateNotFoundError,
    InvalidResumeError,
    DocumentProcessingError,
)


def _safe_filename(filename: str) -> str:
    return re.sub(r"[^\w.\- ]", "_", os.path.basename(filename))


def _as_stream(content: bytes) -> BytesIO:
    stream = BytesIO(content)
    stream.seek(0)
    return stream

router = APIRouter(prefix="", tags=["Resumes / Candidates"])


# ----- Resumes (upload entrypoint) -----

@router.post("/resumes", response_model=CandidateUploadResponse, status_code=201)
async def upload_resumes(
    job_id: int = Form(...),
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise JobNotFoundError(f"Job {job_id} not found.")
    if not files:
        return CandidateUploadResponse(success=False, message="No files uploaded.")

    errors = []
    created: List[Candidate] = []

    for f in files:
        try:
            content = await f.read()
            if not content:
                raise InvalidResumeError("Uploaded file is empty.")
            validate_upload(f.filename or "", len(content))
            safe_name = _safe_filename(f.filename or "resume")
            stream = _as_stream(content)
            validate_document(stream, filename_hint=f.filename)
            stream.seek(0)
            text = extract_document_text(stream, filename_hint=f.filename)

            cand = Candidate(
                job_id=job.id,
                resume_file_name=safe_name,
                resume_text=text,
            )
            db.add(cand)
            db.flush()
            try:
                cand = extract_and_persist_candidate_profile(db, cand)
            except Exception:
                db.refresh(cand)

            created.append(cand)
        except Exception as e:
            errors.append({"file": f.filename or "unknown", "error": str(e)})

    success = len(created) > 0
    return CandidateUploadResponse(
        success=success,
        message=(
            f"Processed {len(created)} resume(s) successfully. "
            f"{len(errors)} file(s) had errors."
            if errors
            else f"Successfully uploaded and processed {len(created)} resume(s)."
        ),
        candidates=[_to_response(c) for c in created],
        errors=errors,
    )


# ----- Candidates (read list / single) -----

@router.get("/candidates", response_model=CandidateListResponse)
def list_candidates(
    job_id: int = Query(None, description="Filter by job id"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    q = db.query(Candidate)
    if job_id is not None:
        q = q.filter(Candidate.job_id == job_id)
    total = q.count()
    rows = q.order_by(Candidate.created_at.desc()).offset(skip).limit(limit).all()
    return CandidateListResponse(candidates=[_to_response(c) for c in rows], total=total)


@router.get("/candidates/{candidate_id}", response_model=CandidateResponse)
def get_candidate(candidate_id: int, db: Session = Depends(get_db)):
    cand = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not cand:
        raise CandidateNotFoundError(f"Candidate {candidate_id} not found.")
    return _to_response(cand)


def _to_response(cand: Candidate) -> CandidateResponse:
    return CandidateResponse(
        id=cand.id,
        job_id=cand.job_id,
        resume_file_name=cand.resume_file_name,
        profile=CandidateProfile(
            name=cand.name,
            email=cand.email,
            phone=cand.phone,
            skills=cand.skills or [],
            experience_years=cand.experience_years,
            experience_summary=cand.experience_summary,
            education=cand.education or [],
            projects=cand.projects or [],
            certifications=cand.certifications or [],
            additional_skills=cand.additional_skills or [],
        ),
        created_at=cand.created_at,
    )
