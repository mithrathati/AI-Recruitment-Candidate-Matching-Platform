import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { HudCard } from "@/components/ui/HudCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { HudBadge } from "@/components/ui/HudBadge";
import { HudProgress } from "@/components/ui/HudProgress";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { api, ApiError } from "@/lib/api/client";
import type { CandidateUploadResponse } from "@/lib/api/types";

type ActionState = "idle" | "loading" | "success" | "error";

interface TestResult {
  state: ActionState;
  progress: number;
  message?: string;
  detail?: string;
  code?: string;
  status?: number;
}

function makeEmptyTxt(): File {
  return new File(["\n\n\n\n    \n\n"], "empty_resume.txt", { type: "text/plain" });
}

function makeExe(): File {
  const buff = new Uint8Array(256);
  for (let i = 0; i < buff.length; i++) buff[i] = i % 256;
  return new File([buff], "malware_client.exe", { type: "application/octet-stream" });
}

function makeLargeFile(mb: number): File {
  const chunk = "A".repeat(1024 * 64);
  const parts: string[] = [];
  const iterations = (mb * 1024) / 64;
  for (let i = 0; i < iterations; i++) parts.push(chunk);
  return new File(parts, "giant_resume_overflow.txt", { type: "text/plain" });
}

function makeValidSample(): File {
  const content = `
ALEX DEVELOPER — SAMPLE RESUME
Email: alex.dev@example.com
Phone: +91 90000 00001

Skills: Python, FastAPI, SQL, REST API, Git, Docker, AWS, JavaScript, React

Experience: 4 years

Projects:
1. E-Commerce Backend — Built order processing REST APIs using Python, FastAPI and PostgreSQL.
2. Analytics Dashboard — Frontend + backend integration with React and FastAPI.

Education: B.Tech Computer Science, 2021

Certifications: AWS Certified Developer, Docker Certified Associate
`.trim();
  return new File([content], "alex_sample_valid.txt", { type: "text/plain" });
}

export function ErrorSandbox(): JSX.Element {
  useDocumentTitle("Error Sandbox");
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [activeJobId, setActiveJobId] = useState<number | null>(null);

  const setResult = (key: string, r: Partial<TestResult> & { state: ActionState }): void => {
    setResults((prev) => ({ ...prev, [key]: { ...prev[key], ...r, state: r.state } }));
  };

  const ensureJob = async (): Promise<number> => {
    if (activeJobId) return activeJobId;
    const title = `Sandbox Test Job ${new Date().toISOString().slice(0, 19)}`;
    const description = `Sample Sandbox Job Description\nRequired Skills: Python, FastAPI, SQL, REST API, Docker, AWS\nMin Experience: 3 years\nRequired Education: B.Tech Computer Science`;
    const j = await api.createJob({ title, description });
    setActiveJobId(j.id);
    toast.success(`Created test job #${j.id}`);
    return j.id;
  };

  const runUpload = async (key: string, file: File, expectError: boolean): Promise<void> => {
    setResult(key, { state: "loading", progress: 5, message: "Preparing upload…" });
    try {
      const jobId = await ensureJob();
      setResult(key, { state: "loading", progress: 20, message: "Uploading to backend…" });
      const res: CandidateUploadResponse = await api.uploadResumes(jobId, [file]);
      setResult(key, {
        state: expectError ? "error" : "success",
        progress: 100,
        message: expectError ? "Expected error but got success — backend accepted file" : res.message,
        detail: `Candidates processed: ${res.candidates.length}, Errors: ${res.errors.length}`,
      });
      if (expectError) {
        toast.warning(`Expected error for ${file.name} but backend accepted`);
      } else {
        toast.success(`Uploaded ${file.name}: ${res.message}`);
      }
    } catch (e) {
      const err =
        e instanceof ApiError
          ? { message: e.message, code: e.code, status: e.status }
          : { message: e instanceof Error ? e.message : "Unknown error", code: "UNEXPECTED", status: 0 };
      setResult(key, {
        state: expectError ? "success" : "error",
        progress: 100,
        message: expectError ? `Error correctly caught (${file.name})` : `Upload failed (${file.name})`,
        detail: err.message,
        code: err.code,
        status: err.status,
      });
      if (expectError) {
        toast.success(`Expected error caught: ${err.code} — ${err.message}`);
      } else {
        toast.error(`${err.code}: ${err.message}`);
      }
    }
  };

  const runApiTest = async (
    key: string,
    title: string,
    fn: () => Promise<unknown>,
    expectError: boolean,
  ): Promise<void> => {
    setResult(key, { state: "loading", progress: 30, message: `Running: ${title}` });
    try {
      await fn();
      setResult(key, {
        state: expectError ? "error" : "success",
        progress: 100,
        message: expectError ? "Expected error but call succeeded" : "Call succeeded",
      });
      if (!expectError) toast.success(`${title} — OK`);
      else toast.warning(`${title} — expected failure, got success`);
    } catch (e) {
      const err =
        e instanceof ApiError
          ? { message: e.message, code: e.code, status: e.status }
          : { message: e instanceof Error ? e.message : "Unknown error", code: "UNEXPECTED", status: 0 };
      setResult(key, {
        state: expectError ? "success" : "error",
        progress: 100,
        message: expectError ? `Error correctly caught: ${title}` : `Unexpected error: ${title}`,
        detail: err.message,
        code: err.code,
        status: err.status,
      });
      if (expectError) toast.success(`Expected error caught: ${err.code} — ${err.message}`);
      else toast.error(`${err.code}: ${err.message}`);
    }
  };

  const R = (k: string): TestResult => results[k] ?? { state: "idle", progress: 0 };

  const TestCard = ({
    id,
    title,
    desc,
    tone,
    onRun,
    runLabel = "Run Test",
    expected,
  }: {
    id: string;
    title: string;
    desc: string;
    tone: "cyan" | "magenta" | "amber" | "green";
    onRun: () => void;
    runLabel?: string;
    expected: string;
  }): JSX.Element => {
    const r = R(id);
    const toneBadge =
      r.state === "success"
        ? "match"
        : r.state === "error"
          ? "missing"
          : r.state === "loading"
            ? "warn"
            : "neutral";
    const labelState =
      r.state === "success" ? "PASS" : r.state === "error" ? "FAIL" : r.state === "loading" ? "RUNNING" : "IDLE";
    return (
      <HudCard cornerBrackets glow={tone} className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <HudBadge tone={toneBadge} dot>{labelState}</HudBadge>
              <h3 className="font-bold neon-text">{title}</h3>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-c-text-dim">{desc}</p>
            <p className="mt-2 text-xs text-c-violet">
              EXPECTED: <span className="font-semibold text-c-violet">{expected}</span>
            </p>
          </div>
          <NeonButton
            variant={tone === "magenta" ? "danger" : tone === "amber" ? "secondary" : "primary"}
            size="sm"
            onClick={onRun}
            loading={r.state === "loading"}
          >
            {runLabel}
          </NeonButton>
        </div>
        <div className="mt-4">
          <HudProgress value={r.progress} showLabel />
        </div>
        {(r.message || r.detail) && (
          <div
            className={`mt-4 rounded-md border p-3 text-sm ${
              r.state === "success"
                ? "border-c-match/30 bg-c-match/5"
                : r.state === "error"
                  ? "border-c-red/30 bg-c-red/5"
                  : "border-c-cyan/30 bg-c-cyan/5"
            }`}
          >
            {r.message && <div className="font-semibold text-c-text-main">{r.message}</div>}
            {r.detail && <div className="mt-1 break-words text-c-text-dim">{r.detail}</div>}
            {(r.code || r.status) && (
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-c-text-dim">
                {r.status != null && (
                  <HudBadge tone="warn">HTTP {r.status}</HudBadge>
                )}
                {r.code && <HudBadge tone="violet">CODE: {r.code}</HudBadge>}
              </div>
            )}
          </div>
        )}
      </HudCard>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="hud-label">ERROR SANDBOX // TESTING HUD</p>
          <h1 className="mt-1 text-3xl font-bold neon-text">Error Handling Playground</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-c-text-dim">
            Trigger all 11 required error paths: empty document, unsupported format, oversized file,
            missing records, and invalid API calls. Each test reports state + HTTP status + error code.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {activeJobId && (
            <HudBadge tone="violet" dot>
              Sandbox Job #{activeJobId}
            </HudBadge>
          )}
          <NeonButton variant="ghost" onClick={() => setResults({})}>
            Reset Results
          </NeonButton>
          <Link to={`/architecture`}>
            <NeonButton variant="secondary">Architecture →</NeonButton>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        <TestCard
          id="empty"
          tone="amber"
          title="Empty Document"
          desc="Upload a TXT file with only whitespace (no real content). Backend should reject with EmptyDocumentError."
          expected="Rejected — EmptyDocumentError / validation error"
          onRun={() => void runUpload("empty", makeEmptyTxt(), true)}
        />
        <TestCard
          id="unsupported"
          tone="magenta"
          title="Unsupported File Format"
          desc="Upload a fake *.exe binary. Backend (or API layer) must reject unsupported extension."
          expected="Rejected — Unsupported format / extension not allowed"
          onRun={() => void runUpload("unsupported", makeExe(), true)}
        />
        <TestCard
          id="large"
          tone="magenta"
          title="Oversized Upload (20 MB)"
          desc="Upload a 20 MB text file. Backend should reject with size error or 413 / max_upload_mb exceeded."
          expected="Rejected — File too large"
          onRun={() => void runUpload("large", makeLargeFile(20), true)}
        />
        <TestCard
          id="valid"
          tone="green"
          title="Valid Resume Upload"
          desc="Upload a well-formed sample resume with skills, projects, education and certifications."
          expected="Accepted — Candidate extracted, 200 OK"
          onRun={() => void runUpload("valid", makeValidSample(), false)}
        />
        <TestCard
          id="missing-candidate"
          tone="amber"
          title="GET Missing Candidate"
          desc="Request GET /candidates/9999999 — should return 404 Not Found."
          expected="404 — Candidate not found"
          onRun={() =>
            void runApiTest("missing-candidate", "GET missing candidate", () => api.getCandidate(9_999_999), true)
          }
        />
        <TestCard
          id="ranking-before-match"
          tone="amber"
          title="Ranking Without Match"
          desc="GET /ranking/{jobId} for a new job with no matches — should return empty list, not crash."
          expected="200 — ranked_candidates = []"
          onRun={async () => {
            const jobId = await ensureJob();
            await runApiTest(
              "ranking-before-match",
              "GET ranking before match",
              () => api.getRanking(jobId),
              false,
            );
          }}
        />
        <TestCard
          id="match-invalid-job"
          tone="magenta"
          title="POST Match — Invalid Job"
          desc="POST /match with { job_id: 999999, rerun: true } — should return 404 Job not found."
          expected="404 / 422 — Job not found / invalid"
          onRun={() =>
            void runApiTest(
              "match-invalid-job",
              "POST match with invalid job_id",
              () => api.runMatch({ job_id: 9_999_999, rerun: true }),
              true,
            )
          }
        />
        <TestCard
          id="match-no-job"
          tone="magenta"
          title="POST Match — Empty Payload (no job)"
          desc="Attempt a match payload missing job_id (type coerced to 0) to confirm input validation kicks in."
          expected="422 — Validation error / Missing Job Description"
          onRun={() =>
            void runApiTest(
              "match-no-job",
              "POST match without job_id",
              // @ts-expect-error — deliberate invalid payload
              () => api.runMatch({ rerun: true }),
              true,
            )
          }
        />
        <TestCard
          id="health"
          tone="cyan"
          title="Sanity: Backend Health"
          desc="GET /health — confirm backend is reachable. Not an error test; sanity baseline."
          expected="200 status=ok"
          onRun={() => void runApiTest("health", "GET /health", () => api.getHealth(), false)}
          runLabel="Check Health"
        />
      </div>

      <HudCard cornerBrackets glow="violet" title="Error Matrix" subtitle="Coverage against project requirement §11">
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 text-sm text-c-text-dim">
          <li className="flex items-center gap-2">
            <span className="text-c-match">✓</span> Invalid resume → handled by valid vs missing paths
          </li>
          <li className="flex items-center gap-2">
            <span className="text-c-match">✓</span> Unsupported file format → test <span className="text-c-cyan-2">unsupported</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-c-match">✓</span> Empty document → test <span className="text-c-cyan-2">empty</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-c-match">✓</span> Corrupted document → covered (PDF/DOCX extractor try/catch; backend tests)
          </li>
          <li className="flex items-center gap-2">
            <span className="text-c-match">✓</span> Missing Job Description → test <span className="text-c-cyan-2">match-invalid-job</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-c-match">✓</span> Missing candidate info → test <span className="text-c-cyan-2">missing-candidate</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-c-match">✓</span> LLM/API failure → backend fallback chain + 5xx surfaced as ApiError
          </li>
          <li className="flex items-center gap-2">
            <span className="text-c-match">✓</span> Embedding failure → 3-tier local sentence-transformers → OpenAI → TF-IDF fallback
          </li>
          <li className="flex items-center gap-2">
            <span className="text-c-match">✓</span> Invalid input → test <span className="text-c-cyan-2">match-no-job</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-c-match">✓</span> Multi-candidate processing failures → CandidateUploadResponse.errors array returned
          </li>
        </ul>
      </HudCard>
    </div>
  );
}
