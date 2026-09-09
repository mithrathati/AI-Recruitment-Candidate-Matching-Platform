from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.schemas import (
    MatchRequest,
    RankingResponse,
)
from app.services.recruitment_service import (
    run_matching_for_job,
    get_ranking_for_job,
)

router = APIRouter(tags=["Matching & Ranking"])


@router.post("/match")
def run_matching(payload: MatchRequest, db: Session = Depends(get_db)):
    results = run_matching_for_job(
        db,
        job_id=payload.job_id,
        candidate_ids=payload.candidate_ids,
        rerun=payload.rerun,
    )
    return {
        "job_id": payload.job_id,
        "total_matches": len(results),
        "matches": results,
    }


@router.get("/ranking/{job_id}", response_model=RankingResponse)
def get_ranking(job_id: int, db: Session = Depends(get_db)):
    return get_ranking_for_job(db, job_id)
