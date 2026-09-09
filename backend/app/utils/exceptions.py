from typing import Optional


class RecruitmentError(Exception):
    code = "recruitment_error"
    status_code = 400

    def __init__(self, message: str, code: Optional[str] = None, status_code: Optional[int] = None):
        super().__init__(message)
        self.message = message
        if code is not None:
            self.code = code
        if status_code is not None:
            self.status_code = status_code


# ---------- Document / Upload ----------

class UnsupportedFileFormatError(RecruitmentError):
    code = "unsupported_file_format"
    status_code = 400


class FileTooLargeError(RecruitmentError):
    code = "file_too_large"
    status_code = 413


class EmptyDocumentError(RecruitmentError):
    code = "empty_document"
    status_code = 400


class CorruptedDocumentError(RecruitmentError):
    code = "corrupted_document"
    status_code = 422


class InvalidResumeError(RecruitmentError):
    code = "invalid_resume"
    status_code = 422


class DocumentProcessingError(RecruitmentError):
    code = "document_processing_failed"
    status_code = 500


# ---------- Resource ----------

class NotFoundError(RecruitmentError):
    code = "not_found"
    status_code = 404


class JobNotFoundError(NotFoundError):
    code = "job_not_found"


class CandidateNotFoundError(NotFoundError):
    code = "candidate_not_found"


class MissingJobDescriptionError(RecruitmentError):
    code = "missing_job_description"
    status_code = 400


class MissingCandidateInformationError(RecruitmentError):
    code = "missing_candidate_information"
    status_code = 400


# ---------- AI Services ----------

class LLMServiceError(RecruitmentError):
    code = "llm_service_failed"
    status_code = 502


class LLMResponseParseError(RecruitmentError):
    code = "llm_response_parse_failed"
    status_code = 502


class EmbeddingServiceError(RecruitmentError):
    code = "embedding_service_failed"
    status_code = 502


# ---------- Matching ----------

class NoCandidatesError(RecruitmentError):
    code = "no_candidates"
    status_code = 400


class NoMatchResultsError(RecruitmentError):
    code = "no_match_results"
    status_code = 404


class InvalidInputError(RecruitmentError):
    code = "invalid_input"
    status_code = 400
