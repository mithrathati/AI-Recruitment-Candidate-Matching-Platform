from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from app.utils.exceptions import (
    RecruitmentError,
    UnsupportedFileFormatError,
    FileTooLargeError,
    EmptyDocumentError,
    CorruptedDocumentError,
    InvalidResumeError,
    DocumentProcessingError,
    NotFoundError,
    JobNotFoundError,
    CandidateNotFoundError,
    MissingJobDescriptionError,
    MissingCandidateInformationError,
    LLMServiceError,
    LLMResponseParseError,
    EmbeddingServiceError,
    NoCandidatesError,
    NoMatchResultsError,
    InvalidInputError,
)


def register_error_handlers(app):
    @app.exception_handler(RecruitmentError)
    async def _recruitment_handler(request: Request, exc: RecruitmentError):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.message, "code": exc.code},
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_handler(request: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=422,
            content={"detail": "Invalid input", "code": "validation_error", "errors": exc.errors()},
        )

    @app.exception_handler(Exception)
    async def _generic_handler(request: Request, exc: Exception):
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error", "code": "internal_server_error"},
        )
