import os
import re
import hashlib
import aiofiles
from typing import Optional, Tuple, List
from app.config import settings
from app.utils.exceptions import UnsupportedFileFormatError, FileTooLargeError


def ensure_upload_dir() -> str:
    upload_dir = settings.UPLOAD_DIR
    os.makedirs(upload_dir, exist_ok=True)
    return upload_dir


def validate_upload(filename: str, size_bytes: int) -> None:
    if not filename:
        raise UnsupportedFileFormatError("No filename provided")
    ext = os.path.splitext(filename)[1].lower()
    if ext not in settings.allowed_extensions_list:
        raise UnsupportedFileFormatError(
            f"Unsupported file format '{ext}'. Allowed formats: {settings.allowed_extensions_list}"
        )
    if size_bytes > settings.max_upload_bytes:
        raise FileTooLargeError(
            f"File too large. Maximum allowed size is {settings.MAX_UPLOAD_SIZE_MB}MB."
        )


async def save_uploaded_file(filename: str, content: bytes) -> Tuple[str, str]:
    upload_dir = ensure_upload_dir()
    safe_name = re.sub(r"[^\w.\- ]", "_", os.path.basename(filename))
    file_hash = hashlib.sha1(content).hexdigest()[:10]
    ext = os.path.splitext(safe_name)[1]
    stored_name = f"{file_hash}_{safe_name}"
    stored_path = os.path.join(upload_dir, stored_name)
    async with aiofiles.open(stored_path, "wb") as f:
        await f.write(content)
    return stored_path, safe_name


def file_extension(path: str) -> str:
    return os.path.splitext(path)[1].lower().lstrip(".")


def clean_text(text: str) -> str:
    if not text:
        return ""
    text = text.replace("\r", "\n")
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()


def chunk_text(text: str, max_chars: int = 6000, overlap: int = 300) -> List[str]:
    text = clean_text(text)
    if len(text) <= max_chars:
        return [text]
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + max_chars, len(text))
        if end < len(text):
            last_nl = text.rfind("\n", start + max_chars - 400, end)
            if last_nl > start + 200:
                end = last_nl + 1
        chunks.append(text[start:end].strip())
        start = end - overlap
        if start < 0:
            start = 0
        if start == 0 and len(chunks) > 1:
            break
    return chunks


def normalize_skill(skill: str) -> str:
    return re.sub(r"[^a-z0-9+#]", "", skill.strip().lower())


def skills_overlap(a: List[str], b: List[str]) -> List[str]:
    na = {normalize_skill(s) for s in a if s and normalize_skill(s)}
    out = []
    for s in b:
        if normalize_skill(s) in na:
            out.append(s)
    return out
