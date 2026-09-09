import re
import math
from typing import List, Optional, Tuple, Dict, Any
from collections import Counter

import numpy as np

from app.config import settings
from app.utils.exceptions import EmbeddingServiceError
from app.utils.file_utils import normalize_skill


try:
    from sklearn.metrics.pairwise import cosine_similarity as _sk_cos
except Exception:  # pragma: no cover - sklearn is in requirements.txt
    _sk_cos = None


class EmbeddingService:
    """
    Embedding + semantic matching service with multi-backend support:
      1) Local sentence-transformers (best, offline, default).
      2) OpenAI embeddings via API.
      3) Fallback: TF-IDF + char n-gram similarity (no model download needed).

    All three converge on a single interface:
        embed(texts) -> np.ndarray shape (N, D)
        semantic_similarity(a, b) -> float 0..1
        semantic_match_many(query, candidates, threshold) -> matched, scores
    """

    TFIDF_NGRAM = (2, 4)

    def __init__(self):
        self._local_model = None
        self._local_loaded = False
        self._openai_client = None
        self._tfidf_vectorizer = None
        self._tfidf_vocab = None
        self._init()

    # ---------- init ----------
    def _init(self):
        if settings.USE_LOCAL_EMBEDDINGS:
            try:
                from sentence_transformers import SentenceTransformer
                self._local_model = SentenceTransformer(settings.LOCAL_EMBEDDING_MODEL)
                self._local_loaded = True
                return
            except Exception:
                self._local_loaded = False

        if settings.OPENAI_API_KEY:
            try:
                from openai import OpenAI
                self._openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
                return
            except Exception:
                self._openai_client = None

        self._init_tfidf()

    def _init_tfidf(self):
        self._tfidf_vocab = self._build_tfidf_vocab([
            "python", "fastapi", "django", "flask", "node", "express", "react", "vue",
            "angular", "javascript", "typescript", "java", "spring", "c++", "csharp", "dotnet",
            "go", "golang", "rust", "ruby", "php", "laravel", "sql", "mysql", "postgresql",
            "postgres", "mongodb", "redis", "elasticsearch", "docker", "kubernetes", "k8s",
            "aws", "amazon", "ec2", "s3", "rds", "ecs", "eks", "lambda", "azure", "gcp",
            "cloud", "cicd", "git", "github", "gitlab", "linux", "ubuntu",
            "rest", "restapi", "graphql", "microservices", "machinelearning", "ml", "nlp",
            "computervision", "tensorflow", "pytorch", "sklearn", "pandas", "dataanalysis",
            "excel", "powerbi", "tableau", "agile", "scrum", "jira", "html", "css", "sass",
            "tailwind", "nextjs", "nuxt", "jenkins", "terraform", "ansible", "prometheus",
            "hadoop", "spark", "kafka", "snowflake", "bigquery", "airflow", "dbt",
            "communication", "teamwork", "leadership", "problemsolving", "oop", "api",
            "backend", "frontend", "fullstack", "unittest", "pytest", "jest", "tdd", "devops",
            "genai", "generativeai", "langchain", "llm", "gpt", "prompt", "orchestration",
            "database", "architecture", "systemdesign", "security", "oauth", "jwt", "authentication",
            "encryption", "container", "ci", "cd", "deployment", "production", "scalable",
            "performance", "debugging", "testing", "automation", "scripting", "etl",
            "bachelor", "master", "phd", "diploma", "btech", "bsc", "msc", "mba", "graduate",
            "experience", "years", "senior", "junior", "lead", "engineer", "developer", "analyst",
            "project", "certification", "aws saa", "ckad",
        ])

    def _build_tfidf_vocab(self, seeds: List[str]) -> Dict[str, int]:
        vocab: Dict[str, int] = {}
        n_min, n_max = self.TFIDF_NGRAM
        for w in seeds:
            for n in range(n_min, n_max + 1):
                for i in range(len(w) - n + 1):
                    gram = w[i:i + n]
                    vocab.setdefault(gram, len(vocab))
        return vocab

    @property
    def backend(self) -> str:
        if self._local_loaded and self._local_model is not None:
            return f"sentence-transformers:{settings.LOCAL_EMBEDDING_MODEL}"
        if self._openai_client is not None:
            return f"openai:{settings.OPENAI_EMBEDDING_MODEL}"
        return "tfidf-fallback"

    # ---------- core embedding ----------
    def embed(self, texts: List[str]) -> np.ndarray:
        if not texts:
            return np.zeros((0, 1), dtype=np.float32)
        clean_inputs = [t if (t and len(t.strip()) > 0) else " " for t in texts]
        if self._local_loaded and self._local_model is not None:
            try:
                embs = self._local_model.encode(
                    clean_inputs, convert_to_numpy=True, show_progress_bar=False
                )
                return self._norm(embs)
            except Exception as e:
                raise EmbeddingServiceError(f"Local embedding failed: {e}")

        if self._openai_client is not None:
            try:
                resp = self._openai_client.embeddings.create(
                    input=clean_inputs, model=settings.OPENAI_EMBEDDING_MODEL
                )
                vectors = [np.array(x.embedding, dtype=np.float32) for x in resp.data]
                return self._norm(np.vstack(vectors))
            except Exception as e:
                raise EmbeddingServiceError(f"OpenAI embedding failed: {e}")

        return self._tfidf_embed(clean_inputs)

    def _norm(self, arr: np.ndarray) -> np.ndarray:
        if arr.ndim == 1:
            arr = arr.reshape(1, -1)
        norms = np.linalg.norm(arr, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        return arr / norms

    # ---------- fallback TF-IDF ----------
    def _tokenize_ngrams(self, text: str) -> List[str]:
        t = re.sub(r"[^a-z0-9]", "", text.lower())
        grams: List[str] = []
        n_min, n_max = self.TFIDF_NGRAM
        for n in range(n_min, n_max + 1):
            for i in range(len(t) - n + 1):
                grams.append(t[i:i + n])
        return grams

    def _tfidf_embed(self, texts: List[str]) -> np.ndarray:
        n_docs = len(texts)
        dim = len(self._tfidf_vocab)
        if dim == 0:
            return np.zeros((n_docs, 1), dtype=np.float32)
        doc_grams = [self._tokenize_ngrams(t) for t in texts]
        counts = np.zeros((n_docs, dim), dtype=np.float32)
        for i, grams in enumerate(doc_grams):
            for g in grams:
                idx = self._tfidf_vocab.get(g)
                if idx is not None:
                    counts[i, idx] += 1.0
        df = (counts > 0).sum(axis=0)
        idf = np.log((n_docs + 1) / (df + 1)) + 1.0
        tfidf = counts * idf
        return self._norm(tfidf)

    # ---------- similarity helpers ----------
    def _cosine(self, a: np.ndarray, b: np.ndarray) -> np.ndarray:
        if a.size == 0 or b.size == 0:
            return np.zeros((a.shape[0] if a.size else 0, b.shape[0] if b.size else 0), dtype=np.float32)
        if _sk_cos is not None:
            return _sk_cos(a, b)
        return (a @ b.T).astype(np.float32)

    def semantic_similarity(self, text_a: str, text_b: str) -> float:
        if not text_a or not text_b:
            return 0.0
        if normalize_skill(text_a) and normalize_skill(text_a) == normalize_skill(text_b):
            return 1.0
        embs = self.embed([text_a, text_b])
        sim = float(np.dot(embs[0], embs[1]))
        # Exact normalized-skill match boost handled above; otherwise clamp
        return max(0.0, min(1.0, sim))

    # ---------- semantic matching ----------
    def semantic_match_many(
        self,
        query: str,
        candidates: List[str],
        threshold: float = 0.65,
    ) -> Tuple[List[Tuple[int, float]], List[Tuple[str, float]]]:
        """
        Compare one query (string) against many candidate strings.
        Returns:
          (matches with indices/scores, matches with strings/scores)
        both sorted by score descending, score >= threshold.
        """
        if not query or not candidates:
            return [], []
        texts = [query] + list(candidates)
        embs = self.embed(texts)
        qv = embs[0:1]
        cvs = embs[1:]
        sims = self._cosine(qv, cvs)[0]
        exact_q = normalize_skill(query)
        if exact_q:
            for i, c in enumerate(candidates):
                if exact_q == normalize_skill(c):
                    sims[i] = 1.0
        ranked = sorted(enumerate(sims), key=lambda x: x[1], reverse=True)
        above = [(i, float(s)) for i, s in ranked if s >= threshold]
        above_with_text = [(candidates[i], s) for i, s in above]
        return above, above_with_text

    # -------------------------------------------------------------
    # Higher-level matchers used by scoring engine.
    # -------------------------------------------------------------
    def match_skill_lists(
        self,
        required_skills: List[str],
        candidate_skills: List[str],
        threshold: float = 0.70,
    ) -> Dict[str, Any]:
        """
        For each required skill, find the best candidate skill match using
        semantic similarity. Also compute per-required-skill match score.
        Returns: {
            matched: List[({req, cand, score})],
            matched_required_names: [req names matched],
            matched_candidate_names: [candidate names matched],
            unmatched_required: [required names with no good match],
            per_required_scores: {req_name: best_score}
        }
        """
        if not required_skills or not candidate_skills:
            return {
                "matched": [],
                "matched_required_names": [],
                "matched_candidate_names": [],
                "unmatched_required": list(required_skills),
                "per_required_scores": {r: 0.0 for r in required_skills},
            }
        all_texts = list(required_skills) + list(candidate_skills)
        embs = self.embed(all_texts)
        req_embs = embs[: len(required_skills)]
        cand_embs = embs[len(required_skills):]
        sim = self._cosine(req_embs, cand_embs)  # shape (R, C)

        # Exact normalized skill match => 1.0
        # Also "token containment": candidate's normalized phrase CONTAINS the exact required
        # skill token e.g. required="AWS", candidate="AWS cloud services" => match.
        req_norm = [normalize_skill(r) for r in required_skills]
        cand_norm = [normalize_skill(c) for c in candidate_skills]

        def _cand_tokens(cand_phrase_norm: str) -> set:
            # Split candidate on common separators AFTER lowercasing but preserve chars we allow.
            # Simpler: tokenize original string by whitespace/punctuation, normalize each.
            idx = cand_norm.index(cand_phrase_norm) if cand_phrase_norm in cand_norm else -1
            if idx < 0:
                return {cand_phrase_norm}
            orig = candidate_skills[idx]
            tokens = re.split(r"[\s,;/()\-_]+", orig.strip())
            return {normalize_skill(t) for t in tokens if normalize_skill(t)}

        cand_norm_tokens = [_cand_tokens(cn) for cn in cand_norm]
        for i, rn in enumerate(req_norm):
            if not rn:
                continue
            for j, cn in enumerate(cand_norm):
                if rn == cn:
                    sim[i, j] = 1.0
                elif rn in cand_norm_tokens[j]:
                    # Containment: required appears as an exact token in candidate phrase
                    sim[i, j] = 1.0

        matched: List[Dict[str, Any]] = []
        matched_cand_idx = set()
        matched_req_names: List[str] = []
        matched_cand_names: List[str] = []
        per_required_scores: Dict[str, float] = {}
        unmatched_required: List[str] = []

        # Best-first greedy assignment
        order = sorted(
            ((i, j) for i in range(len(required_skills)) for j in range(len(candidate_skills))),
            key=lambda ij: sim[ij[0], ij[1]],
            reverse=True,
        )
        used_req: set = set()
        used_cand: set = set()
        for i, j in order:
            if i in used_req or j in used_cand:
                continue
            score = float(sim[i, j])
            if score >= threshold:
                matched.append({
                    "required": required_skills[i],
                    "candidate": candidate_skills[j],
                    "score": score,
                })
                matched_req_names.append(required_skills[i])
                matched_cand_names.append(candidate_skills[j])
                used_req.add(i)
                used_cand.add(j)

        for i, req in enumerate(required_skills):
            if i in used_req:
                # should be exactly the matched score; grab from matched
                for m in matched:
                    if m["required"] == req:
                        per_required_scores[req] = float(m["score"])
                        break
            else:
                best_any = float(sim[i].max()) if sim.shape[1] > 0 else 0.0
                per_required_scores[req] = float(best_any)
                unmatched_required.append(req)

        return {
            "matched": matched,
            "matched_required_names": matched_req_names,
            "matched_candidate_names": matched_cand_names,
            "unmatched_required": unmatched_required,
            "per_required_scores": per_required_scores,
        }

    def semantic_text_overlap_score(self, query_paragraph: str, candidate_text: str) -> float:
        """
        Generic semantic overlap score between two free-form blurbs
        (e.g. "3+ years Python backend experience" vs a candidate experience paragraph).
        """
        if not query_paragraph or not candidate_text:
            return 0.0
        # Split into short sentences/chunks on both sides and take max pairwise.
        def _chunks(t: str, n: int = 300):
            t = re.sub(r"\s+", " ", t).strip()
            if len(t) <= n:
                return [t]
            return [t[i:i + n] for i in range(0, len(t), n // 2)]

        q_parts = [p for p in _chunks(query_paragraph, 400) if len(p) > 20]
        c_parts = [p for p in _chunks(candidate_text, 400) if len(p) > 20]
        if not q_parts or not c_parts:
            return 0.0
        texts = q_parts + c_parts
        embs = self.embed(texts)
        qe = embs[: len(q_parts)]
        ce = embs[len(q_parts):]
        m = self._cosine(qe, ce)
        # Mean of best-column for each query chunk.
        best_per_q = m.max(axis=1)
        return float(np.clip(best_per_q.mean(), 0.0, 1.0))


embedding_service = EmbeddingService()
