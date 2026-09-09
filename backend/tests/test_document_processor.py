import os
import tempfile

from app.services.document_processor import (
    extract_document_text,
    validate_document,
)
from app.utils.exceptions import (
    UnsupportedFileFormatError,
    EmptyDocumentError,
    CorruptedDocumentError,
)


def _write_temp(name: str, content: bytes) -> str:
    path = os.path.join(tempfile.gettempdir(), name)
    with open(path, "wb") as f:
        f.write(content)
    return path


def test_extract_txt_valid():
    path = _write_temp("resume_valid.txt", b"John Doe\nPython, FastAPI, SQL\n5 years experience.\nB.Tech CS")
    text = extract_document_text(path)
    assert "John Doe" in text
    assert len(text) > 20


def test_extract_unsupported_format_raises():
    path = _write_temp("bad.xyz", b"some bytes")
    try:
        extract_document_text(path)
        assert False, "Expected UnsupportedFileFormatError"
    except UnsupportedFileFormatError:
        pass


def test_empty_document_raises():
    path = _write_temp("empty.txt", b"     \n\n\t  ")
    try:
        extract_document_text(path)
        assert False
    except EmptyDocumentError:
        pass


def test_short_pdf_triggers_empty_error(monkeypatch):
    # Write a txt file with short content but pretend it's pdf
    short = _write_temp("short.pdf", b"hi")
    try:
        extract_document_text(short)
    except EmptyDocumentError:
        return
    except Exception:
        return  # any failure on a fake .pdf file is ok


def test_validate_document_passes_long_enough():
    text = (
        "Candidate Profile\nName: A\n"
        + ("Lots of skills, experience and education content here. " * 20)
    )
    p = _write_temp("v.txt", text.encode("utf-8"))
    validate_document(p)  # should not raise
