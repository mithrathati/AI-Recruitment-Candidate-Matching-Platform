from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime


# ========== Jobs ==========

class JobCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=255, description="Job title")
    description: str = Field(..., min_length=20, description="Full job description text")


class JobRequirementExtract(BaseModel):
    required_skills: List[str] = Field(default_factory=list)
    nice_to_have_skills: List[str] = Field(default_factory=list)
    min_experience_years: Optional[float] = None
    required_education: Optional[str] = None
    requirements_summary: Optional[str] = None


class JobResponse(BaseModel):
    id: int
    title: str
    description: str
    requirements: Optional[JobRequirementExtract] = None
    required_skills: Optional[List[str]] = None
    nice_to_have_skills: Optional[List[str]] = None
    min_experience_years: Optional[float] = None
    required_education: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class JobListResponse(BaseModel):
    jobs: List[JobResponse]
    total: int


# ========== Candidates ==========

class CandidateProfile(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    skills: List[str] = Field(default_factory=list)
    experience_years: Optional[float] = None
    experience_summary: Optional[str] = None
    education: List[Dict[str, Any]] = Field(default_factory=list)
    projects: List[Dict[str, Any]] = Field(default_factory=list)
    certifications: List[str] = Field(default_factory=list)
    additional_skills: List[str] = Field(default_factory=list)


class CandidateResponse(BaseModel):
    id: int
    job_id: int
    resume_file_name: str
    profile: CandidateProfile
    created_at: datetime

    class Config:
        from_attributes = True


class CandidateListResponse(BaseModel):
    candidates: List[CandidateResponse]
    total: int


class CandidateUploadResponse(BaseModel):
    success: bool
    message: str
    candidates: List[CandidateResponse] = Field(default_factory=list)
    errors: List[Dict[str, str]] = Field(default_factory=list)


# ========== Matching / Scoring ==========

class MatchRequest(BaseModel):
    job_id: int = Field(..., description="Job to match against")
    candidate_ids: Optional[List[int]] = Field(default=None, description="Specific candidates; omit for all in job")
    rerun: bool = Field(default=False, description="Force re-compute even if match exists")


class SkillGap(BaseModel):
    matching_skills: List[str] = Field(default_factory=list)
    missing_skills: List[str] = Field(default_factory=list)


class CategoryScores(BaseModel):
    required_skills_score: float
    experience_score: float
    projects_score: float
    education_cert_score: float
    additional_skills_score: float


class MatchResultResponse(BaseModel):
    candidate_id: int
    candidate_name: Optional[str]
    overall_score: float
    scores: CategoryScores
    skill_gap: SkillGap
    strengths: List[str] = Field(default_factory=list)
    weaknesses: List[str] = Field(default_factory=list)
    explanation: Optional[str] = None
    rank: Optional[int] = None


class RankingResponse(BaseModel):
    job_id: int
    job_title: str
    ranked_candidates: List[MatchResultResponse]
    total: int


# ========== Error ==========

class ErrorResponse(BaseModel):
    detail: str
    code: Optional[str] = None
