import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { HudCard } from "@/components/ui/HudCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { HudBadge } from "@/components/ui/HudBadge";
import { HudSkeleton } from "@/components/ui/HudSkeleton";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { useActiveJob } from "@/context/AppContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { api, ApiError } from "@/lib/api/client";
import type { CandidateResponse, JobResponse, MatchResultResponse } from "@/lib/api/types";
import { formatDate, truncate } from "@/lib/utils";

type ViewMode = "grid" | "table";

export function CandidatesList(): JSX.Element {
  useDocumentTitle("Candidates");
  const navigate = useNavigate();
  const { setActiveJob } = useActiveJob();
  const [search] = useSearchParams();
  const filterJobId = search.get("job_id") ? Number(search.get("job_id")) : null;
  const [jobs, setJobs] = useState<JobResponse[] | null>(null);
  const [candidates, setCandidates] = useState<CandidateResponse[] | null>(null);
  const [rankingByJob, setRankingByJob] = useState<Record<number, MatchResultResponse[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(filterJobId);
  const [q, setQ] = useState("");
  const [view, setView] = useState<ViewMode>("grid");

  const load = async (): Promise<void> => {
    setLoading(true);
    try {
      const [jRes, cRes] = await Promise.all([
        api.listJobs({ limit: 200 }),
        api.listCandidates({ job_id: selectedJobId ?? undefined, limit: 500 }),
      ]);
      setJobs(jRes.jobs);
      setCandidates(cRes.candidates);
      const ranksEntries = await Promise.all(
        [...new Set(cRes.candidates.map((c) => c.job_id))].map((jid) =>
          api
            .getRanking(jid)
            .then((r) => [jid, r.ranked_candidates] as const)
            .catch(() => [jid, [] as MatchResultResponse[]] as const),
        ),
      );
      setRankingByJob(Object.fromEntries(ranksEntries));
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Failed to load candidates.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [selectedJobId]);

  const filtered = useMemo(() => {
    let list = [...(candidates ?? [])];
    if (q.trim()) {
      const needle = q.toLowerCase();
      list = list.filter((c) => {
        const p = c.profile;
        return (
          (p.name ?? "").toLowerCase().includes(needle) ||
          (p.email ?? "").toLowerCase().includes(needle) ||
          p.skills.some((s) => s.toLowerCase().includes(needle))
        );
      });
    }
    return list;
  }, [candidates, q]);

  const scoreFor = (c: CandidateResponse): { score: number | null; rank: number | null } => {
    const arr = rankingByJob[c.job_id] ?? [];
    const r = arr.find((x) => x.candidate_id === c.id);
    return { score: r?.overall_score ?? null, rank: r?.rank ?? null };
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="hud-label">CANDIDATE INVENTORY</div>
          <h1 className="mt-1 text-3xl font-black tracking-tight">
            <span className="neon-text--cyan">Candidates</span>
          </h1>
          <p className="mt-2 text-c-text-dim">
            Structured profiles extracted from uploaded resumes via LLM pipeline.
            Click any candidate to inspect full profile details, projects, and certifications.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div>
            <label className="hud-label-text">Filter by Job</label>
            <select
              className="hud-select"
              style={{ width: 260 }}
              value={selectedJobId ?? ""}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : null;
                setSelectedJobId(id);
                if (id) {
                  const j = jobs?.find((x) => x.id === id);
                  if (j) setActiveJob(j);
                }
                const sp = new URLSearchParams();
                if (id) sp.set("job_id", String(id));
                navigate({ search: sp.toString() }, { replace: true });
              }}
            >
              <option value="">All Jobs</option>
              {(jobs ?? []).map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="hud-label-text">Search</label>
            <input
              className="hud-input"
              style={{ width: 260 }}
              placeholder="Name, email, skill…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="flex gap-0.5 self-end">
            <NeonButton size="sm" variant={view === "grid" ? "primary" : "ghost"} onClick={() => setView("grid")}>
              ▦ Grid
            </NeonButton>
            <NeonButton size="sm" variant={view === "table" ? "primary" : "ghost"} onClick={() => setView("table")}>
              ☰ Table
            </NeonButton>
          </div>
        </div>
      </header>

      {loading ? (
        view === "grid" ? (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <HudSkeleton key={i} lines={4} style={{ height: 240 }} />
            ))}
          </div>
        ) : (
          <HudCard cornerBrackets>
            <HudSkeleton lines={8} style={{ height: 320 }} />
          </HudCard>
        )
      ) : (filtered.length === 0 ? (
        <HudCard cornerBrackets glow="cyan">
          <div className="text-center py-10">
            <div className="hud-label">NO CANDIDATES</div>
            <h3 className="mt-2 text-xl font-bold">No candidates found</h3>
            <p className="mt-2 text-c-text-dim">
              {selectedJobId ? "Upload resumes for this job first." : "Upload some resumes for a job to see candidates here."}
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              {selectedJobId && (
                <Link to={`/jobs/${selectedJobId}/upload`}>
                  <NeonButton size="lg">Upload Resumes</NeonButton>
                </Link>
              )}
              {!selectedJobId && (
                <Link to="/jobs">
                  <NeonButton size="lg">Browse Jobs</NeonButton>
                </Link>
              )}
            </div>
          </div>
        </HudCard>
      ) : view === "grid" ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const { score, rank } = scoreFor(c);
            return (
              <HudCard
                key={c.id}
                cornerBrackets
                soft
                glow="violet"
                className="h-full flex flex-col"
                title={
                  <Link
                    to={`/candidates/${c.id}`}
                    className="text-lg font-bold text-c-text-main truncate block hover:neon-text transition-colors"
                  >
                    {c.profile.name ?? "Unknown Candidate"}
                  </Link>
                }
                subtitle={
                  <span className="truncate">
                    {c.profile.email ?? "no email"}
                    {c.profile.phone ? ` · ${c.profile.phone}` : ""}
                  </span>
                }
                actions={
                  score != null ? (
                    <ScoreRing score={score} size={68} strokeWidth={8} showLabel={false} />
                  ) : (
                    <HudBadge tone="neutral" className="!text-[0.68rem]">No score</HudBadge>
                  )
                }
              >
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {c.profile.experience_years != null && (
                    <HudBadge tone="warn" className="!text-[0.68rem]">
                      {c.profile.experience_years} yrs exp
                    </HudBadge>
                  )}
                  {rank != null && (
                    <HudBadge tone="violet" className="!text-[0.68rem]">Rank #{rank}</HudBadge>
                  )}
                  <HudBadge tone="neutral" className="!text-[0.68rem]">
                    Job #{c.job_id}
                  </HudBadge>
                </div>
                <div className="mb-3">
                  <div className="hud-label mb-1.5">TOP SKILLS</div>
                  <div className="flex flex-wrap gap-1.5">
                    {c.profile.skills.length === 0 ? (
                      <HudBadge tone="neutral" className="!text-[0.65rem]">None extracted</HudBadge>
                    ) : (
                      c.profile.skills.slice(0, 8).map((s) => (
                        <HudBadge key={s} tone="match" className="!text-[0.65rem]">{s}</HudBadge>
                      ))
                    )}
                  </div>
                </div>
                <div className="mt-auto pt-4 flex items-center justify-between text-xs text-c-text-dim">
                  <span>Uploaded {formatDate(c.created_at)}</span>
                  <Link to={`/candidates/${c.id}`}>
                    <NeonButton variant="ghost" size="sm">View Profile →</NeonButton>
                  </Link>
                </div>
              </HudCard>
            );
          })}
        </div>
      ) : (
        <HudCard cornerBrackets glow="cyan" className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.02] border-b border-c-border-soft">
                <tr className="text-left">
                  <th className="px-5 py-3 hud-label">Rank</th>
                  <th className="px-5 py-3 hud-label">Candidate</th>
                  <th className="px-5 py-3 hud-label">Skills</th>
                  <th className="px-5 py-3 hud-label">Exp</th>
                  <th className="px-5 py-3 hud-label">Score</th>
                  <th className="px-5 py-3 hud-label text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-c-border-soft">
                {filtered.map((c) => {
                  const { score, rank } = scoreFor(c);
                  return (
                    <tr key={c.id} className="hover:bg-c-cyan/[0.03] transition-colors">
                      <td className="px-5 py-4">
                        {rank != null ? <HudBadge tone="violet">#{rank}</HudBadge> : <span className="text-c-text-dim">—</span>}
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-c-text-main">{c.profile.name ?? "Unknown"}</div>
                        <div className="text-xs text-c-text-dim truncate max-w-xs">
                          {c.profile.email ?? "no email"} · {truncate(c.resume_file_name, 30)}
                        </div>
                      </td>
                      <td className="px-5 py-4 max-w-sm">
                        <div className="flex flex-wrap gap-1">
                          {c.profile.skills.slice(0, 5).map((s) => (
                            <HudBadge key={s} tone="match" className="!text-[0.62rem]">{s}</HudBadge>
                          ))}
                          {c.profile.skills.length > 5 && (
                            <HudBadge tone="neutral" className="!text-[0.62rem]">+{c.profile.skills.length - 5}</HudBadge>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 tabular-nums text-c-text-dim">
                        {c.profile.experience_years ?? "—"}
                      </td>
                      <td className="px-5 py-4">
                        {score != null ? (
                          <div className="flex items-center gap-2">
                            <div className="hud-progress w-28">
                              <div className="hud-progress__fill" style={{ width: `${score}%` }} />
                            </div>
                            <span className="font-bold text-c-cyan tabular-nums w-10 text-right">
                              {Math.round(score)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-c-text-dim">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link to={`/candidates/${c.id}`}>
                          <NeonButton size="sm" variant="ghost">Open →</NeonButton>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </HudCard>
      ))}
    </div>
  );
}
