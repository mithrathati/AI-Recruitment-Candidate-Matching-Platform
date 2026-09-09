import type {
  CandidateListParams,
  CandidateListResponse,
  CandidateResponse,
  CandidateUploadResponse,
  ErrorResponse,
  HealthResponse,
  ID,
  InfoResponse,
  JobCreate,
  JobListResponse,
  JobResponse,
  MatchRequest,
  MatchRunResponse,
  MatchResultResponse,
  RankingResponse,
  ApiErrorShape,
} from "./types";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

export class ApiError extends Error implements ApiErrorShape {
  readonly status: number;
  readonly code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
  toJSON(): ApiErrorShape {
    return { message: this.message, status: this.status, code: this.code };
  }
}

interface DoFetchOptions {
  timeoutMs?: number;
  body?: unknown;
  query?: Record<string, unknown>;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  credentials?: RequestCredentials;
  mode?: RequestMode;
  cache?: RequestCache;
}

async function doFetch<T>(
  method: string,
  path: string,
  init?: DoFetchOptions,
): Promise<T> {
  const timeoutMs = init?.timeoutMs ?? 120_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const url = new URL(BASE + path, window.location.origin);
  if (init?.query) {
    for (const [k, v] of Object.entries(init.query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.append(k, String(v));
    }
  }
  const headers: Record<string, string> = { ...(init?.headers ?? {}) };
  const rawBody = init?.body as unknown;
  const isFormData = typeof FormData !== "undefined" && rawBody instanceof FormData;
  if (!isFormData && rawBody !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  headers["Accept"] = "application/json";
  try {
    const fetchInit: RequestInit = {
      method,
      headers,
      signal: init?.signal ?? controller.signal,
      credentials: init?.credentials,
      mode: init?.mode,
      cache: init?.cache,
    };
    if (isFormData) {
      fetchInit.body = rawBody as BodyInit;
    } else if (rawBody !== undefined) {
      fetchInit.body = JSON.stringify(rawBody);
    }
    const res = await fetch(url.toString(), fetchInit);
    const contentType = res.headers.get("content-type") ?? "";
    const isJson = contentType.includes("application/json");
    const body = isJson
      ? ((await res.json()) as unknown)
      : await res.text();
    if (!res.ok) {
      const err = (isJson ? (body as ErrorResponse) : { detail: String(body) }) ?? {};
      const message =
        typeof (err as ErrorResponse).detail === "string"
          ? (err as ErrorResponse).detail
          : `HTTP ${res.status} ${res.statusText}`;
      const code = (err as ErrorResponse).code ?? `HTTP_${res.status}`;
      throw new ApiError(message, res.status, code);
    }
    return body as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if ((e as Error).name === "AbortError") {
      throw new ApiError("Request timed out. The backend may still be processing.", 408, "TIMEOUT");
    }
    throw new ApiError(
      "Backend unreachable — ensure uvicorn is running on http://127.0.0.1:8000.",
      0,
      "CONNECTION_REFUSED",
    );
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  getHealth: () => doFetch<HealthResponse>("GET", "/health"),
  getInfo: () => doFetch<InfoResponse>("GET", "/info"),

  createJob: (payload: JobCreate) =>
    doFetch<JobResponse>("POST", "/jobs", { body: payload }),
  listJobs: (params?: { skip?: number; limit?: number }) =>
    doFetch<JobListResponse>("GET", "/jobs", { query: params as Record<string, unknown> }),
  getJob: (id: ID) => doFetch<JobResponse>("GET", `/jobs/${id}`),
  reExtractJob: (id: ID) => doFetch<JobResponse>("POST", `/jobs/${id}/re-extract`),

  uploadResumes: (jobId: ID, files: File[], timeoutMs = 180_000) => {
    const fd = new FormData();
    fd.append("job_id", String(jobId));
    for (const f of files) fd.append("files", f);
    return doFetch<CandidateUploadResponse>("POST", "/resumes", {
      body: fd,
      timeoutMs,
    });
  },
  listCandidates: (params?: CandidateListParams) =>
    doFetch<CandidateListResponse>("GET", "/candidates", {
      query: params as unknown as Record<string, unknown>,
    }),
  getCandidate: (id: ID) => doFetch<CandidateResponse>("GET", `/candidates/${id}`),

  runMatch: (payload: MatchRequest) =>
    doFetch<MatchRunResponse>("POST", "/match", {
      body: payload,
      timeoutMs: 300_000,
    }),
  getRanking: (jobId: ID) => doFetch<RankingResponse>("GET", `/ranking/${jobId}`),
  getMatchResultByCandidate: (jobId: ID, candidateId: ID) =>
    doFetch<RankingResponse>("GET", `/ranking/${jobId}`).then(
      (r) =>
        r.ranked_candidates.find((c) => c.candidate_id === candidateId) ??
        (Promise.reject(
          new ApiError(`No match result for candidate ${candidateId}`, 404, "NO_MATCH"),
        ) as unknown as MatchResultResponse),
    ),
};
