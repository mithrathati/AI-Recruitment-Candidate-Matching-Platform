from app.services.embedding_service import embedding_service


def test_backend_is_not_none():
    assert embedding_service.backend
    # With USE_LOCAL_EMBEDDINGS=false and no API key in tests, we should be on tfidf fallback
    assert "tfidf" in embedding_service.backend or "sentence" in embedding_service.backend or "openai" in embedding_service.backend


def test_embed_shape_and_norm():
    embs = embedding_service.embed(["python rest api backend", "java spring microservices"])
    assert embs.shape[0] == 2
    assert embs.shape[1] >= 1
    # rows should be unit length for tf-idf / sent-transformer outputs
    import numpy as np
    norms = np.linalg.norm(embs, axis=1)
    for n in norms:
        assert abs(n - 1.0) < 0.05 or abs(n - 0.0) < 1e-6


def test_semantic_similarity_exact_match_is_high():
    s = embedding_service.semantic_similarity("Python", "Python")
    assert s >= 0.99


def test_semantic_similarity_related_vs_unrelated():
    related = embedding_service.semantic_similarity(
        "Python backend development experience with REST APIs FastAPI Django PostgreSQL",
        "Developed REST APIs using Python, FastAPI and Django with PostgreSQL backend"
    )
    unrelated = embedding_service.semantic_similarity(
        "Python backend development experience with REST APIs FastAPI Django PostgreSQL",
        "Culinary arts and pastry making professional with cake decoration expertise chocolate bakery"
    )
    assert related > unrelated + 0.10, f"related={related} unrelated={unrelated}"


def test_match_skill_lists_distinguishes():
    required = ["Python", "FastAPI", "AWS", "Kubernetes", "Docker"]
    candidate = ["Python programming", "FastAPI framework", "Docker containers",
                 "AWS cloud services", "HTML", "CSS"]
    out = embedding_service.match_skill_lists(required, candidate, threshold=0.5)
    assert isinstance(out["matched_required_names"], list)
    assert isinstance(out["unmatched_required"], list)
    unmatched_names = [s.lower() for s in out["unmatched_required"]]
    matched_names = [s.lower() for s in out["matched_required_names"]]
    assert any("kubernetes" in s for s in unmatched_names)
    for target in ["python", "fastapi", "aws", "docker"]:
        assert any(target in s for s in matched_names), f"missing {target} in {matched_names}"


def test_semantic_match_many_returns_ordered():
    query = "Python backend development experience"
    candidates = [
        "Developed REST APIs using Python, FastAPI and Django",
        "Machine learning researcher publishing in top-tier conferences",
        "Professional pastry chef",
    ]
    idxs, with_text = embedding_service.semantic_match_many(query, candidates, threshold=0.0)
    assert len(idxs) == len(candidates)
    # best should be index 0 (backend dev match)
    assert idxs[0][0] == 0
    assert with_text[0][0] == candidates[0]
