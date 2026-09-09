import os
import sys
import tempfile

os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")

# Make the backend/ directory importable for tests
TEST_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(TEST_DIR)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_recruitment.db")
os.environ.setdefault("USE_LOCAL_EMBEDDINGS", "false")
os.environ.setdefault("OPENAI_API_KEY", "")  # ensure rule-based fallback


def _remove_db():
    try:
        if os.path.exists("./test_recruitment.db"):
            os.remove("./test_recruitment.db")
    except OSError:
        pass


_remove_db()

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app


@pytest.fixture(scope="session")
def engine_fixture():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db(engine_fixture):
    TestingSessionLocal = sessionmaker(
        autocommit=False, autoflush=False, bind=engine_fixture
    )
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture()
def client(db):
    def _get_db_override():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = _get_db_override
    with TestClient(app) as tc:
        yield tc
    app.dependency_overrides.pop(get_db, None)


@pytest.fixture()
def sample_job_payload():
    return {
        "title": "Senior Python Backend Engineer",
        "description": (
            "We are looking for a Senior Python Backend Engineer with 5+ years of experience "
            "building scalable REST APIs using Python, FastAPI and SQL. Required skills include "
            "Python, FastAPI, PostgreSQL, REST API, Docker, and AWS. Nice-to-have: Kubernetes, "
            "Redis, Kafka, CI/CD. Education: B.Tech or Bachelor in CS. Must have experience with "
            "microservices architecture and have deployed to production on AWS."
        ),
    }


@pytest.fixture()
def good_resume_text():
    return (
        "Aarav Sharma\n"
        "Email: aarav.sharma@example.com  Phone: +91-98765-43210\n\n"
        "EXPERIENCE: 6 years of professional software engineering experience. "
        "Worked as a Senior Backend Engineer at TechCorp from 2019 to Present, where I "
        "designed and developed REST APIs using Python, FastAPI, and Django. Built scalable "
        "microservices deployed to production on AWS (ECS, RDS, S3) using Docker containers. "
        "Worked with PostgreSQL for transactional data modeling and query optimization. "
        "Owned CI/CD pipelines using GitHub Actions and Jenkins.\n\n"
        "EDUCATION: B.Tech in Computer Science from IIT Delhi, 2015 - 2019.\n\n"
        "SKILLS: Python, FastAPI, Django, PostgreSQL, REST API, Docker, AWS, Redis, Kafka, "
        "Git, Linux, Microservices, CI/CD, Pytest, SQL, PostgreSQL.\n\n"
        "PROJECTS:\n"
        "- Title: Order Management Microservice. Description: Built FastAPI-based "
        "order processing service on AWS using Docker, PostgreSQL, Redis for caching, "
        "and Kafka for event streaming. Reduced p95 latency by 40%.\n"
        "- Title: Auth Service. Description: Implemented JWT-based authentication service "
        "in Python FastAPI with PostgreSQL. Integrated with AWS Cognito.\n\n"
        "CERTIFICATIONS: AWS Certified Solutions Architect – Associate, "
        "Certified Kubernetes Application Developer (CKAD)."
    )


@pytest.fixture()
def mediocre_resume_text():
    return (
        "Priya Verma\n"
        "Email: priya.v@example.com\n\n"
        "Experience: 2 years in IT support and scripting. "
        "Some exposure to Python scripts for automation. "
        "Used basic SQL queries and a small Flask internal web app.\n\n"
        "Education: B.Com from University of Mumbai, 2020 - 2023.\n\n"
        "Skills: Python, SQL, Flask, MS Excel, Word, basic Linux.\n"
    )


@pytest.fixture()
def differently_worded_resume_text():
    # Tests semantic matching vs exact keywords.
    return (
        "Rohan Mehta\n"
        "Email: rohan.m@example.com\n\n"
        "SUMMARY: Backend specialist with 5+ years building production systems.\n"
        "EXPERIENCE: 2020 - Present at XYZ Systems: developed HTTP APIs in Python using "
        "ASGI frameworks (FastAPI, Starlette), used relational DBs (Postgres, MySQL), "
        "containerized services with Docker, ran on Amazon cloud (EC2, S3, RDS). "
        "Experienced with container orchestration platforms similar to Kubernetes, "
        "and have worked extensively with in-memory caches like Redis and pub/sub "
        "messaging pipelines.\n"
        "Education: Bachelor of Technology, Computer Science (2016-2020).\n"
        "Skills: Python programming, API Development, Postgres, Docker, AWS cloud, "
        "container orchestration, Redis caching, Linux administration, Git."
    )


@pytest.fixture()
def empty_resume_text():
    return "   \n\n\t\n"


@pytest.fixture()
def _temp_txt_file(tmp_path, content: str):
    # helper called directly
    p = tmp_path / "resume.txt"
    p.write_text(content, encoding="utf-8")
    return str(p)
