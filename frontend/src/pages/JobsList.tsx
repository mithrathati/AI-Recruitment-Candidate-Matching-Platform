import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { HudCard } from "@/components/ui/HudCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { HudBadge } from "@/components/ui/HudBadge";
import { HudSkeleton } from "@/components/ui/HudSkeleton";
import { ModalShell } from "@/components/common/Modals";
import { useActiveJob } from "@/context/AppContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { api, ApiError } from "@/lib/api/client";
import type { JobCreate, JobResponse, CandidateResponse } from "@/lib/api/types";
import { formatDate, truncate } from "@/lib/utils";

export function JobsList(): JSX.Element {
  useDocumentTitle("Jobs");
  const navigate = useNavigate();
  const { setActiveJob } = useActiveJob();
  const [jobs, setJobs] = useState<JobResponse[] | null>(null);
  const [candidates, setCandidates] = useState<CandidateResponse[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"newest" | "candidates">("newest");
  const [createOpen, setCreateOpen] = useState(false);

  const load = async (): Promise<void> => {
    setLoading(true);
    try {
      const [jRes, cRes] = await Promise.all([
        api.listJobs({ limit: 200 }),
        api.listCandidates({ limit: 500 }),
      ]);
      setJobs(jRes.jobs);
      setCandidates(cRes.candidates);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Failed to load jobs.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const candCountByJob = useMemo(() => {
    const map: Record<number, number> = {};
    for (const c of candidates ?? []) map[c.job_id] = (map[c.job_id] ?? 0) + 1;
    return map;
  }, [candidates]);

  const filtered = useMemo(() => {
    let list = [...(jobs ?? [])];
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (j) => j.title.toLowerCase().includes(q) || j.description.toLowerCase().includes(q),
      );
    }
    if (sort === "newest") {
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else {
      list.sort((a, b) => (candCountByJob[b.id] ?? 0) - (candCountByJob[a.id] ?? 0));
    }
    return list;
  }, [jobs, query, sort, candCountByJob]);

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="hud-label">JOBS INVENTORY</div>
          <h1 className="mt-1 text-3xl font-black tracking-tight">
            <span className="neon-text--cyan">Job Descriptions</span>
          </h1>
          <p className="mt-2 text-c-text-dim max-w-2xl">
            Create, view, and manage Job Descriptions. Each job automatically extracts required skills,
            experience, and education using the LLM pipeline with a robust rule-based fallback.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div>
              <label className="hud-label-text">Search</label>
              <input
                className="hud-input"
                placeholder="Search by title or description…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ width: 260 }}
              />
            </div>
            <div>
              <label className="hud-label-text">Sort</label>
              <select
                className="hud-select"
                value={sort}
                onChange={(e) => setSort(e.target.value as "newest" | "candidates")}
                style={{ width: 180 }}
              >
                <option value="newest">Newest first</option>
                <option value="candidates">Candidate count</option>
              </select>
            </div>
          </div>
          <NeonButton onClick={() => setCreateOpen(true)} size="lg">
            + New Job
          </NeonButton>
        </div>
      </header>

      {loading ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <HudSkeleton key={i} lines={4} style={{ height: 230 }} />
          ))}
        </div>
      ) : (jobs?.length ?? 0) === 0 ? (
        <HudCard cornerBrackets glow="cyan">
          <div className="text-center py-10">
            <div className="hud-label">NO JOBS YET</div>
            <h3 className="mt-2 text-xl font-bold text-c-text-main">
              Begin by creating your first Job Description
            </h3>
            <p className="mt-2 text-c-text-dim">
              Paste a title and description — the system will extract skills, experience, and education.
            </p>
            <div className="mt-6">
              <NeonButton size="lg" onClick={() => setCreateOpen(true)}>
                + Create Job Description
              </NeonButton>
            </div>
          </div>
        </HudCard>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((j) => (
            <HudCard
              key={j.id}
              cornerBrackets
              soft
              glow="cyan"
              className="h-full flex flex-col"
              title={
                <Link
                  to={`/jobs/${j.id}`}
                  onClick={() => setActiveJob(j)}
                  className="text-lg font-bold tracking-wide hover:neon-text transition-colors text-c-text-main truncate block max-w-full"
                  title={j.title}
                >
                  {j.title}
                </Link>
              }
              subtitle={`Created ${formatDate(j.created_at)} · ID #${j.id}`}
              actions={
                <HudBadge tone="violet" className="!text-[0.68rem]">
                  {candCountByJob[j.id] ?? 0} candidates
                </HudBadge>
              }
            >
              <p className="text-sm text-c-text-dim leading-relaxed line-clamp-3">
                {truncate(j.description, 180)}
              </p>

              <div className="mt-4">
                <div className="hud-label mb-2">EXTRACTED SKILLS</div>
                <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                  {(j.required_skills ?? []).length === 0 ? (
                    <HudBadge tone="neutral" className="!text-[0.68rem]">Not extracted</HudBadge>
                  ) : (
                    <>
                      {(j.required_skills ?? []).slice(0, 8).map((s) => (
                        <HudBadge key={s} tone="match" className="!text-[0.68rem]">
                          {s}
                        </HudBadge>
                      ))}
                      {(j.required_skills ?? []).length > 8 && (
                        <HudBadge tone="neutral" className="!text-[0.68rem]">
                          +{(j.required_skills ?? []).length - 8} more
                        </HudBadge>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="mt-auto pt-5 flex items-center justify-between gap-3">
                <HudBadge tone="warn" className="!text-[0.68rem]" dot={!!j.min_experience_years}>
                  {j.min_experience_years ? `Min ${j.min_experience_years} yrs` : j.required_education ?? "No min exp"}
                </HudBadge>
                <Link
                  to={`/jobs/${j.id}`}
                  onClick={() => setActiveJob(j)}
                  className="shrink-0"
                >
                  <NeonButton size="sm" variant="ghost">View Details →</NeonButton>
                </Link>
              </div>
            </HudCard>
          ))}
        </div>
      )}

      <CreateJobModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={(j) => {
          setActiveJob(j);
          setCreateOpen(false);
          toast.success("Job created successfully");
          void load().then(() => navigate(`/jobs/${j.id}`));
        }}
      />
    </div>
  );
}

function CreateJobModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (j: JobResponse) => void;
}): JSX.Element {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<{ title?: string; description?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setErrors({});
      setSubmitting(false);
    }
  }, [open]);

  const submit = async (): Promise<void> => {
    const e: typeof errors = {};
    if (title.trim().length < 2) e.title = "Title must be at least 2 characters.";
    if (description.trim().length < 20) e.description = "Description must be at least 20 characters.";
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setSubmitting(true);
    try {
      const payload: JobCreate = { title: title.trim(), description: description.trim() };
      const j = await api.createJob(payload);
      onSuccess(j);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to create job.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell open={open} onClose={onClose} widthClass="max-w-3xl" title="Create New Job Description">
      <div className="space-y-5">
        <div>
          <label className="hud-label-text">Job Title *</label>
          <input
            className="hud-input"
            placeholder="e.g. Senior Python Backend Engineer"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          {errors.title && <div className="text-xs text-c-red mt-1">{errors.title}</div>}
        </div>
        <div>
          <label className="hud-label-text">Job Description *</label>
          <textarea
            className="hud-textarea"
            rows={12}
            placeholder="Paste the full job description including responsibilities, requirements, nice-to-haves, experience, education, etc."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          {errors.description && <div className="text-xs text-c-red mt-1">{errors.description}</div>}
          <div className="mt-2 text-xs text-c-text-dim">
            Tip: The LLM will extract required skills, nice-to-have skills, minimum experience years, and required education.
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 pt-2">
          <NeonButton variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </NeonButton>
          <NeonButton variant="primary" onClick={() => void submit()} loading={submitting}>
            Create Job
          </NeonButton>
        </div>
      </div>
    </ModalShell>
  );
}
