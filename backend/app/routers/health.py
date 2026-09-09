from fastapi import APIRouter

from app.config import settings
from app.services.embedding_service import embedding_service
from app.services.llm_service import llm_service

router = APIRouter(tags=["Health / Info"])


@router.get("/health")
def health():
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }


@router.get("/info")
def system_info():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "embedding_backend": embedding_service.backend,
        "llm_available": llm_service.is_llm_available,
        "llm_model": settings.OPENAI_MODEL if llm_service.is_llm_available else None,
        "scoring_weights": {
            "required_skills": settings.WEIGHT_REQUIRED_SKILLS,
            "experience": settings.WEIGHT_EXPERIENCE,
            "projects": settings.WEIGHT_PROJECTS,
            "education_certifications": settings.WEIGHT_EDUCATION_CERT,
            "additional_skills": settings.WEIGHT_ADDITIONAL_SKILLS,
        },
        "allowed_extensions": settings.allowed_extensions_list,
        "max_upload_mb": settings.MAX_UPLOAD_SIZE_MB,
    }
