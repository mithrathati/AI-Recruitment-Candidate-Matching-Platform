import os
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    APP_NAME: str = "AI Recruitment Platform"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    DATABASE_URL: str = "sqlite:///./recruitment.db"

    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY")
    OPENAI_MODEL: str = "gpt-3.5-turbo"
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"
    OPENAI_TEMPERATURE: float = 0.1
    OPENAI_MAX_TOKENS: int = 2000

    USE_LOCAL_EMBEDDINGS: bool = False
    LOCAL_EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"

    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE_MB: int = 15
    ALLOWED_EXTENSIONS: str = ".pdf,.docx,.txt"

    WEIGHT_REQUIRED_SKILLS: float = 40.0
    WEIGHT_EXPERIENCE: float = 25.0
    WEIGHT_PROJECTS: float = 20.0
    WEIGHT_EDUCATION_CERT: float = 10.0
    WEIGHT_ADDITIONAL_SKILLS: float = 5.0

    SECRET_KEY: str = "change-me"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    @property
    def allowed_extensions_list(self) -> List[str]:
        return [e.strip().lower() for e in self.ALLOWED_EXTENSIONS.split(",") if e.strip()]

    @property
    def max_upload_bytes(self) -> int:
        return self.MAX_UPLOAD_SIZE_MB * 1024 * 1024


settings = Settings()
