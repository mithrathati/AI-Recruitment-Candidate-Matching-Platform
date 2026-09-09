from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    requirements = Column(JSON, nullable=True)
    required_skills = Column(JSON, nullable=True)
    nice_to_have_skills = Column(JSON, nullable=True)
    min_experience_years = Column(Float, nullable=True)
    required_education = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    candidates = relationship("Candidate", back_populates="job", cascade="all, delete-orphan")
    matches = relationship("MatchResult", back_populates="job", cascade="all, delete-orphan")


class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    resume_file_name = Column(String(500), nullable=False)
    resume_text = Column(Text, nullable=False)
    name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(100), nullable=True)
    skills = Column(JSON, nullable=True)
    experience_years = Column(Float, nullable=True)
    experience_summary = Column(Text, nullable=True)
    education = Column(JSON, nullable=True)
    projects = Column(JSON, nullable=True)
    certifications = Column(JSON, nullable=True)
    additional_skills = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    job = relationship("Job", back_populates="candidates")
    match = relationship("MatchResult", back_populates="candidate", uselist=False, cascade="all, delete-orphan")


class MatchResult(Base):
    __tablename__ = "match_results"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    candidate_id = Column(Integer, ForeignKey("candidates.id"), nullable=False, unique=True)
    overall_score = Column(Float, nullable=False)
    required_skills_score = Column(Float, nullable=False)
    experience_score = Column(Float, nullable=False)
    projects_score = Column(Float, nullable=False)
    education_cert_score = Column(Float, nullable=False)
    additional_skills_score = Column(Float, nullable=False)
    matching_skills = Column(JSON, nullable=True)
    missing_skills = Column(JSON, nullable=True)
    strengths = Column(JSON, nullable=True)
    weaknesses = Column(JSON, nullable=True)
    explanation = Column(Text, nullable=True)
    rank = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    job = relationship("Job", back_populates="matches")
    candidate = relationship("Candidate", back_populates="match")
