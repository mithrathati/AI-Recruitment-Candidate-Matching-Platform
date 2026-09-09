import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { HudCard } from "@/components/ui/HudCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { HudBadge } from "@/components/ui/HudBadge";
import { HudSkeleton } from "@/components/ui/HudSkeleton";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { api, ApiError } from "@/lib/api/client";
import type { InfoResponse } from "@/lib/api/types";

interface LegendItem {
  title: string;
  icon: string;
  tone: "cyan" | "magenta" | "violet" | "amber" | "green";
  desc: string;
  link?: string;
}

const LEGEND: LegendItem[] = [
  {
    title: "Frontend (HUD UI)",
    icon: "🎮",
    tone: "cyan",
    desc: "React 18 + TypeScript + Vite + Tailwind v4. Cyberpunk / Valorant HUD neon-glow glassmorphism. Routes: Dashboard, Jobs, Upload, Candidates, Ranking, Match Detail, Architecture, Errors.",
    link: "/",
  },
  {
    title: "Backend (FastAPI)",
    icon: "⚡",
    tone: "magenta",
    desc: "FastAPI with SQLAlchemy ORM + SQLite. Routers: health, jobs, resumes, matching. CORS open for HUD client. Pydantic schemas for every contract.",
    link: "http://127.0.0.1:8000/docs",
  },
  {
    title: "Document Processor",
    icon: "📄",
    tone: "violet",
    desc: "PDF (pdfplumber — encrypted/corrupt handling), DOCX (python-docx — paragraphs + tables), TXT (UTF-8 replace). Empty-document detection + size cap.",
  },
  {
    title: "LLM Extractor",
    icon: "🧠",
    tone: "amber",
    desc: "OpenAI ChatCompletions JSON mode → structured extraction (candidate profile + JD requirements). Rule-based section-parser fallback when LLM unavailable.",
  },
  {
    title: "Embedding Model",
    icon: "🔗",
    tone: "green",
    desc: "3-tier fallback: sentence-transformers (all-MiniLM-L6-v2 local) → OpenAI text-embedding-3-small → TF-IDF char 2–4 grams. Always produces vectors.",
  },
  {
    title: "Matching Engine",
    icon: "🎯",
    tone: "cyan",
    desc: "Semantic matching via embeddings + greedy best-first skill assignment (containment bonus). Thresholds: ≥0.85 strong match, 0.68–0.85 weak match.",
  },
  {
    title: "Database",
    icon: "💾",
    tone: "violet",
    desc: "SQLite with SQLAlchemy ORM. Models: Job, Candidate, MatchResult. All writes wrapped in transactions; idempotent re-extracts.",
  },
  {
    title: "APIs & Contracts",
    icon: "🔌",
    tone: "amber",
    desc: "POST /jobs, GET /jobs, GET /jobs/{id}, POST /jobs/{id}/re-extract, POST /resumes (multi-file), GET /candidates, GET /candidates/{id}, POST /match, GET /ranking/{job_id}, GET /health, GET /info.",
    link: "http://127.0.0.1:8000/redoc",
  },
];

export function Architecture(): JSX.Element {
  useDocumentTitle("Architecture");
  const [info, setInfo] = useState<InfoResponse | null>(null);
  const [infoLoading, setInfoLoading] = useState(true);
  const [diagram, setDiagram] = useState<string | null>(null);
  const [diagramLoading, setDiagramLoading] = useState(true);

  const load = async (): Promise<void> => {
    setInfoLoading(true);
    setDiagramLoading(true);
    try {
      const [i, d] = await Promise.all([
        api.getInfo(),
        fetch("/architecture_diagram.md")
          .then((r) => (r.ok ? r.text() : null))
          .catch(() => null),
      ]);
      setInfo(i);
      setDiagram(d);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Failed to load architecture info.";
      toast.error(msg);
    } finally {
      setInfoLoading(false);
      setDiagramLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const weightsTotal = useMemo(() => {
    if (!info) return 0;
    const w = info.scoring_weights;
    return w.required_skills + w.experience + w.projects + w.education_certifications + w.additional_skills;
  }, [info]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="hud-label">SYSTEM ARCHITECTURE HUD</p>
          <h1 className="mt-1 text-3xl font-bold neon-text">Platform Architecture</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-c-text-dim">
            Full-stack GenAI recruitment platform: Frontend HUD UI → FastAPI backend → Document Processor / LLM / Embeddings / Matching Engine → SQLite.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <NeonButton variant="ghost" onClick={() => void load()}>
            Refresh
          </NeonButton>
          <Link to={`/sandbox/errors`}>
            <NeonButton variant="secondary">Error Sandbox →</NeonButton>
          </Link>
          <a href="http://127.0.0.1:8000/docs" target="_blank" rel="noreferrer">
            <NeonButton variant="primary">Backend Docs (Swagger)</NeonButton>
          </a>
        </div>
      </div>

      <HudCard cornerBrackets glow="cyan" title="Runtime Environment" subtitle="Live backend config via GET /info">
        {infoLoading ? (
          <HudSkeleton lines={10} className="h-[360px]" />
        ) : info ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-md border border-c-cyan/30 bg-c-cyan/5 p-4">
              <p className="hud-label">APP / VERSION</p>
              <p className="mt-1 text-lg font-bold neon-text--cyan">{info.app}</p>
              <HudBadge tone="cyan" className="mt-3">v {info.version}</HudBadge>
            </div>
            <div className="rounded-md border border-c-green/30 bg-c-green/5 p-4">
              <p className="hud-label">EMBEDDING BACKEND</p>
              <p className="mt-1 text-lg font-bold neon-text--green">{info.embedding_backend}</p>
              <p className="mt-2 text-xs text-c-text-dim">Fallback chain: local → OpenAI → TF-IDF</p>
            </div>
            <div className="rounded-md border border-c-amber/30 bg-c-amber/5 p-4">
              <p className="hud-label">LLM STATUS</p>
              <div className="mt-1 flex items-center gap-2">
                {info.llm_available ? (
                  <HudBadge tone="match" dot>ONLINE</HudBadge>
                ) : (
                  <HudBadge tone="warn" dot>RULE-BASED FALLBACK</HudBadge>
                )}
              </div>
              <p className="mt-3 text-sm text-c-text-dim">Model: <span className="text-c-amber font-semibold">{info.llm_model ?? "—"}</span></p>
            </div>
            <div className="rounded-md border border-c-violet/30 bg-c-violet/5 p-4">
              <p className="hud-label">UPLOAD POLICY</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {info.allowed_extensions.map((e) => (
                  <HudBadge key={e} tone="violet">.{e}</HudBadge>
                ))}
              </div>
              <p className="mt-3 text-sm text-c-text-dim">Max size: <span className="text-c-cyan-2 font-semibold">{info.max_upload_mb} MB</span></p>
            </div>

            <div className="xl:col-span-4 md:col-span-2 col-span-1 rounded-md border border-c-magenta/30 bg-c-magenta/5 p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="hud-label">SCORING WEIGHTS</p>
                  <p className="mt-1 text-sm text-c-text-dim">
                    Total = {weightsTotal}% (must equal 100).
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <ScoreRing score={weightsTotal} size={88} strokeWidth={10} label="Total" />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-5">
                <WeightRow label="Required Skills" value={info.scoring_weights.required_skills} tone="cyan" />
                <WeightRow label="Experience" value={info.scoring_weights.experience} tone="violet" />
                <WeightRow label="Projects" value={info.scoring_weights.projects} tone="magenta" />
                <WeightRow label="Education / Cert" value={info.scoring_weights.education_certifications} tone="amber" />
                <WeightRow label="Additional" value={info.scoring_weights.additional_skills} tone="green" />
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-c-text-dim">
            Backend /info unreachable — ensure <code className="text-c-cyan-2">uvicorn app.main:app --port 8000</code> is running.
          </div>
        )}
      </HudCard>

      <HudCard cornerBrackets glow="violet" title="Architecture Diagram" subtitle="public/architecture_diagram.md (Mermaid / markdown)">
        {diagramLoading ? (
          <HudSkeleton lines={14} className="h-[520px]" />
        ) : diagram ? (
          <div className="prose prose-invert max-w-none rounded-md border border-c-violet/30 bg-c-bg-deep/60 p-6 text-c-text-main">
            <ReactMarkdown>{diagram}</ReactMarkdown>
          </div>
        ) : (
          <div className="p-6 text-center text-c-text-dim">
            No diagram file at <code className="text-c-cyan-2">/public/architecture_diagram.md</code>. Drop a Mermaid / markdown file there to visualize.
          </div>
        )}
      </HudCard>

      <div>
        <p className="hud-label">COMPONENT LEGEND</p>
        <h2 className="mt-1 text-2xl font-bold neon-text--magenta">System Components</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {LEGEND.map((l) => (
            <HudCard key={l.title} cornerBrackets glow={l.tone} className="p-5 flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-2xl">{l.icon}</div>
                  <h3 className="mt-2 font-bold neon-text">{l.title}</h3>
                </div>
                <HudBadge tone={l.tone} dot>{l.tone.toUpperCase()}</HudBadge>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-c-text-dim flex-1">{l.desc}</p>
              {l.link && (
                <div className="mt-4">
                  {l.link.startsWith("http") ? (
                    <a href={l.link} target="_blank" rel="noreferrer" className="text-sm text-c-cyan-2 hover:underline">
                      Open {l.title} →
                    </a>
                  ) : (
                    <Link to={l.link} className="text-sm text-c-cyan-2 hover:underline">
                      Open {l.title} →
                    </Link>
                  )}
                </div>
              )}
            </HudCard>
          ))}
        </div>
      </div>

      <HudCard cornerBrackets glow="amber" title="End-to-End Workflow (Requirement §9)">
        <ol className="grid grid-cols-1 gap-3 md:grid-cols-2 text-sm text-c-text-main">
          {[
            ["1", "Job Description", "Recruiter creates or uploads JD via POST /jobs → persisted as Job row."],
            ["2", "Requirement Extraction", "LLM extracts required/nice-to-have skills, min-experience, required-edu, summary."],
            ["3", "Required Skills & Criteria", "Structured JobRequirementExtract JSON + free-text summary stored on Job."],
            ["4", "Resume Upload", "POST /resumes multi-file FormData → Document Processor validates size/extension."],
            ["5", "Resume Processing", "PDF/DOCX/TXT extractors → clean text. Empty/corrupt/encrypted errors surfaced."],
            ["6", "Candidate Profile", "LLM JSON-mode → CandidateProfile (name, email, phone, skills, education, projects, certs). Rule-based fallback."],
            ["7", "Embeddings", "3-tier local/OpenAI/TF-IDF encoder produces vectors for skills, projects, experience text."],
            ["8", "Semantic Matching", "match_skill_lists greedy best-first ≥0.68 with containment bonus; semantic_text_overlap for experience."],
            ["9", "Candidate Scoring", "Weighted 40/25/20/10/5 → overall_score ∈ [0,100]."],
            ["10", "Candidate Ranking", "rank_candidates by overall desc → rank 1..N stored on MatchResult."],
            ["11", "Skill Gap Analysis", "SkillGap.matching_skills (≥0.85) + missing_skills (0.68–0.85 weak + not found)."],
            ["12", "AI Explanation", "generate_explanation: LLM paragraph + strengths/weaknesses bullets → heuristic fallback."],
            ["13", "Recruiter Review", "HUD Ranking Board + Match Detail + Candidate Profile drive review decisions."],
          ].map(([n, title, desc]) => (
            <li key={n} className="flex gap-3 rounded-md border border-c-amber/20 bg-c-amber/5 p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-c-amber/20 text-c-amber font-black shadow-neon-amber tabular-nums">
                {n}
              </div>
              <div>
                <div className="font-bold text-c-text-main">{title}</div>
                <div className="mt-0.5 text-c-text-dim leading-relaxed">{desc}</div>
              </div>
            </li>
          ))}
        </ol>
      </HudCard>
    </div>
  );
}

function WeightRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "cyan" | "magenta" | "violet" | "amber" | "green";
}): JSX.Element {
  const barClass =
    tone === "cyan"
      ? "from-c-cyan/90 to-c-cyan/50"
      : tone === "magenta"
        ? "from-c-magenta to-c-violet"
        : tone === "violet"
          ? "from-c-violet to-c-cyan"
          : tone === "amber"
            ? "from-c-amber to-c-magenta"
            : "from-c-green to-c-cyan";
  const textClass =
    tone === "cyan"
      ? "text-c-cyan-2"
      : tone === "magenta"
        ? "text-c-magenta"
        : tone === "violet"
          ? "text-c-violet"
          : tone === "amber"
            ? "text-c-amber"
            : "text-c-green";
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold text-c-text-main">{label}</span>
        <span className={`text-sm font-bold tabular-nums ${textClass}`}>{value}%</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full border border-c-violet/30 bg-black/30">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${barClass} shadow-[0_0_10px_rgba(0,240,255,0.35)]`}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}
