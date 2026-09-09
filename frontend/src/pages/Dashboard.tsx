import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { HudCard } from "@/components/ui/HudCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { HudBadge } from "@/components/ui/HudBadge";
import { HudSkeleton } from "@/components/ui/HudSkeleton";
import { ScanOverlay } from "@/components/ui/ScanOverlay";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { useActiveJob } from "@/context/AppContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { api, ApiError } from "@/lib/api/client";
import type { CandidateResponse, InfoResponse, JobResponse } from "@/lib/api/types";
import { formatDate, truncate } from "@/lib/utils";

type Status = "loading" | "online" | "offline";

export function Dashboard(): JSX.Element {
  useDocumentTitle("Dashboard");
  const navigate = useNavigate();
  const { activeJob, setActiveJob, activeJobId } = useActiveJob();
  const [jobs, setJobs] = useState<JobResponse[] | null>(null);
  const [candidates, setCandidates] = useState<CandidateResponse[] | null>(null);
  const [info, setInfo] = useState<InfoResponse | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const load = async (): Promise<void> => {
    setStatus("loading");
    setErrMsg(null);
    try {
      const [jRes, cRes, iRes] = await Promise.all([
        api.listJobs({ limit: 50 }),
        api.listCandidates({ limit: 200 }),
        api.getInfo(),
      ]);
      setJobs(jRes.jobs);
      setCandidates(cRes.candidates);
      setInfo(iRes);
      setStatus("online");
      if (!activeJob && jRes.jobs[0]) setActiveJob(jRes.jobs[0]);
    } catch (e) {
      setStatus("offline");
      if (e instanceof ApiError) setErrMsg(e.message);
      else setErrMsg("Failed to contact backend.");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const stats = useMemo(() => {
    const jobTotal = jobs?.length ?? 0;
    const candTotal = candidates?.length ?? 0;
    let avgScore = 0;
    let avgCount = 0;
    if (activeJobId) {
      for (const c of candidates ?? []) {
        if (c.job_id === activeJobId) {
          // Score isn't on CandidateResponse without match; approximate with 0
          avgCount++;
        }
      }
    }
    return { jobTotal, candTotal, avgScore: avgCount ? avgScore / avgCount : 0 };
  }, [jobs, candidates, activeJobId]);

  return (
    <div className="space-y-10">
      {status === "offline" && (
        <HudCard
          glow="magenta"
          cornerBrackets
          className="px-6 py-4"
          actions={
            <NeonButton size="sm" variant="primary" onClick={() => void load()}>
              Retry
            </NeonButton>
          }
          title={
            <span className="text-c-red">Backend Offline</span>
          }
          subtitle={errMsg ?? "Ensure uvicorn is running on http://127.0.0.1:8000"}
        >
          <p className="text-c-text-dim text-sm">
            The frontend cannot reach the FastAPI server. Run{" "}
            <code className="hud-chip hud-chip--warn">cd backend &amp;&amp; uvicorn app.main:app --reload --port 8000</code>{" "}
            and then click Retry.
          </p>
        </HudCard>
      )}

      <section className="relative overflow-hidden rounded-2xl p-8 md:p-12 glass-panel corner-brackets">
        <span className="cb-tl" aria-hidden />
        <span className="cb-br" aria-hidden />
        <div className="absolute inset-0 grid-bg opacity-60 pointer-events-none" />
        <ScanOverlay />
        <div className="relative z-10 max-w-3xl">
          <HudBadge tone="violet" dot className="mb-4">
            DSTARIX TECHNO · GENERATIVE AI RECRUITMENT
          </HudBadge>
          <h1 className="text-4xl md:text-5xl font-black leading-tight tracking-tight">
            <span className="neon-text">AI-Powered Candidate</span>
            <br />
            <span className="neon-text--magenta">Matching &amp; Ranking</span>
          </h1>
          <p className="mt-5 text-c-text-dim text-lg leading-relaxed">
            Upload Job Descriptions and candidate resumes. Leverage LLMs for structured extraction,
            embeddings for semantic matching, weighted scoring, AI-driven explanations, and skill-gap analysis
            — all through a premium cyberpunk HUD interface.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/jobs">
              <NeonButton size="lg">Create Job</NeonButton>
            </Link>
            <Link to="/jobs">
              <NeonButton size="lg" variant="secondary">
                View All Jobs
              </NeonButton>
            </Link>
            <Link to="/architecture">
              <NeonButton size="lg" variant="ghost">
                Architecture
              </NeonButton>
            </Link>
          </div>
        </div>
      </section>

      <section>
        <div className="hud-label mb-3">PLATFORM OVERVIEW</div>
        <div className="grid md:grid-cols-4 gap-4">
          <StatCard
            loading={status === "loading"}
            label="Total Jobs"
            value={stats.jobTotal}
            accent="cyan"
            icon="▤"
          />
          <StatCard
            loading={status === "loading"}
            label="Total Candidates"
            value={stats.candTotal}
            accent="magenta"
            icon="◉"
          />
          <StatCard
            loading={status === "loading" || !info}
            label="Embedding Backend"
            value={info?.embedding_backend ?? "—"}
            accent="violet"
            icon="⚙"
            isText
          />
          <StatCard
            loading={status === "loading"}
            label="Active Job"
            value={activeJob ? truncate(activeJob.title, 28) : "None"}
            accent="green"
            icon="⌂"
            isText
          />
        </div>
      </section>

      <section>
        <div className="hud-label mb-3">QUICK ACTIONS · 4-STEP DEMO WORKFLOW</div>
        <div className="grid md:grid-cols-4 gap-4">
          <ActionCard
            step="1"
            title="Create Job Description"
            desc="Paste a JD and extract structured requirements: skills, experience, education."
            cta="Create Job"
            onClick={() => navigate("/jobs")}
            accent="cyan"
          />
          <ActionCard
            step="2"
            title="Upload Resumes"
            desc="Drag-and-drop PDF/DOCX/TXT resumes for a selected job."
            cta="Upload Resumes"
            onClick={() => {
              if (activeJobId) navigate(`/jobs/${activeJobId}/upload`);
              else toast("Select or create a job first.");
            }}
            accent="magenta"
            disabled={!activeJobId}
          />
          <ActionCard
            step="3"
            title="Run Matching"
            desc="Run semantic matching + weighted scoring for all candidates."
            cta="Run Matching"
            onClick={() => {
              if (!activeJobId) {
                toast("Select or create a job first.");
                return;
              }
              navigate(`/jobs/${activeJobId}/ranking`);
            }}
            accent="violet"
            disabled={!activeJobId}
          />
          <ActionCard
            step="4"
            title="View Ranking & Insights"
            desc="Ranked candidates with score breakdown, skill gaps, and AI explanations."
            cta="View Ranking"
            onClick={() => {
              if (!activeJobId) {
                toast("Select or create a job first.");
                return;
              }
              navigate(`/jobs/${activeJobId}/ranking`);
            }}
            accent="amber"
            disabled={!activeJobId}
          />
        </div>
      </section>

      <section className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <HudCard
            cornerBrackets
            glow="cyan"
            title="Recent Jobs"
            subtitle="Latest 3 job descriptions"
            actions={
              <Link to="/jobs">
                <NeonButton variant="ghost" size="sm">View All →</NeonButton>
              </Link>
            }
          >
            {status === "loading" || jobs === null ? (
              <div className="space-y-3">
                <HudSkeleton lines={3} style={{ height: 90 }} />
                <HudSkeleton lines={3} style={{ height: 90 }} />
                <HudSkeleton lines={3} style={{ height: 90 }} />
              </div>
            ) : jobs.length === 0 ? (
              <EmptyHud
                title="No jobs yet"
                body="Create your first Job Description to begin the workflow."
                cta="Create Job Description"
                onClick={() => navigate("/jobs")}
              />
            ) : (
              <div className="space-y-3">
                {jobs.slice(0, 3).map((j) => (
                  <Link
                    key={j.id}
                    to={`/jobs/${j.id}`}
                    onClick={() => setActiveJob(j)}
                    className="block rounded-xl p-4 border border-c-border-soft hover:border-c-cyan/60 bg-white/[0.02] hover:bg-c-cyan/[0.04] transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-base font-bold text-c-text-main truncate">{j.title}</div>
                        <div className="text-xs text-c-text-dim mt-1">
                          Created {formatDate(j.created_at)}
                        </div>
                        <p className="mt-2 text-sm text-c-text-dim line-clamp-2">
                          {truncate(j.description, 160)}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {(j.required_skills ?? []).slice(0, 6).map((s) => (
                            <HudBadge key={s} tone="match" className="!text-[0.68rem]">
                              {s}
                            </HudBadge>
                          ))}
                          {(j.required_skills ?? []).length > 6 && (
                            <HudBadge tone="neutral" className="!text-[0.68rem]">
                              +{(j.required_skills ?? []).length - 6} more
                            </HudBadge>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <HudBadge tone="violet" className="!text-[0.68rem]">
                          ID #{j.id}
                        </HudBadge>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </HudCard>
        </div>

        <div>
          <HudCard
            cornerBrackets
            glow="magenta"
            title="Scoring Weights"
            subtitle="Weighted candidate scoring methodology"
          >
            <div className="space-y-3">
              <ScoreRing score={40} size={92} strokeWidth={10} />
              <ul className="space-y-2 text-sm">
                <WeightRow label="Required Skills" pct={info?.scoring_weights.required_skills ?? 40} tone="cyan" />
                <WeightRow label="Relevant Experience" pct={info?.scoring_weights.experience ?? 25} tone="magenta" />
                <WeightRow label="Projects" pct={info?.scoring_weights.projects ?? 20} tone="violet" />
                <WeightRow label="Education / Certifications" pct={info?.scoring_weights.education_certifications ?? 10} tone="amber" />
                <WeightRow label="Additional Skills" pct={info?.scoring_weights.additional_skills ?? 5} tone="green" />
              </ul>
            </div>
          </HudCard>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  loading,
  label,
  value,
  accent,
  icon,
  isText,
}: {
  loading: boolean;
  label: string;
  value: string | number;
  accent: "cyan" | "magenta" | "violet" | "green" | "amber";
  icon: string;
  isText?: boolean;
}): JSX.Element {
  return (
    <HudCard cornerBrackets soft glow={accent} className="!p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="hud-label">{label}</div>
          {loading ? (
            <HudSkeleton lines={1} className="mt-3 w-32" style={{ height: 28 }} />
          ) : (
            <div
              className={`mt-3 font-black tracking-tight ${
                isText ? "text-xl" : "text-3xl"
              } ${
                accent === "cyan"
                  ? "neon-text--cyan"
                  : accent === "magenta"
                    ? "neon-text--magenta"
                    : "neon-text"
              }`}
            >
              {value}
            </div>
          )}
        </div>
        <span className="text-2xl text-c-text-dim/70">{icon}</span>
      </div>
    </HudCard>
  );
}

function ActionCard({
  step,
  title,
  desc,
  cta,
  onClick,
  accent,
  disabled,
}: {
  step: string;
  title: string;
  desc: string;
  cta: string;
  onClick: () => void;
  accent: "cyan" | "magenta" | "violet" | "amber";
  disabled?: boolean;
}): JSX.Element {
  const borderClass =
    accent === "cyan"
      ? "hover:border-c-cyan/60"
      : accent === "magenta"
        ? "hover:border-c-magenta/60"
        : accent === "violet"
          ? "hover:border-c-violet/70"
          : "hover:border-c-amber/60";
  return (
    <HudCard
      cornerBrackets
      soft
      glow={accent}
      className="!p-5 h-full flex flex-col"
    >
      <div className="flex items-center gap-3">
        <span className={`hud-chip hud-chip--${accent === "amber" ? "warn" : accent === "cyan" ? "" : accent} !text-xs !font-black !px-3 !py-1`}>
          STEP {step}
        </span>
      </div>
      <h3 className="mt-3 text-lg font-bold text-c-text-main">{title}</h3>
      <p className="mt-2 text-sm text-c-text-dim leading-relaxed flex-1">{desc}</p>
      <div className="mt-4">
        <NeonButton variant={accent === "amber" ? "secondary" : "primary"} size="sm" onClick={onClick} disabled={disabled} className="w-full">
          {cta}
        </NeonButton>
      </div>
    </HudCard>
  );
}

function WeightRow({ label, pct, tone }: { label: string; pct: number; tone: "cyan" | "magenta" | "violet" | "amber" | "green" }): JSX.Element {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="text-c-text-dim">{label}</span>
      <span className={`font-bold tabular-nums ${
        tone === "cyan" ? "text-c-cyan" : tone === "magenta" ? "text-c-magenta" : tone === "violet" ? "text-c-violet" : tone === "amber" ? "text-c-amber" : "text-c-green"
      }`}>{pct}%</span>
    </li>
  );
}

function EmptyHud({
  title,
  body,
  cta,
  onClick,
}: {
  title: string;
  body: string;
  cta: string;
  onClick: () => void;
}): JSX.Element {
  return (
    <div className="text-center py-8">
      <div className="hud-label">EMPTY STATE</div>
      <h4 className="mt-2 text-lg font-bold text-c-text-main">{title}</h4>
      <p className="mt-2 text-c-text-dim text-sm">{body}</p>
      <div className="mt-5">
        <NeonButton onClick={onClick}>{cta}</NeonButton>
      </div>
    </div>
  );
}
