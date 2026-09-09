import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { HudCard } from "@/components/ui/HudCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { HudBadge } from "@/components/ui/HudBadge";
import { HudSkeleton } from "@/components/ui/HudSkeleton";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { CategoryBar } from "@/components/ui/CategoryBar";
import { ConfirmModal } from "@/components/common/Modals";
import { useActiveJob } from "@/context/AppContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { api, ApiError } from "@/lib/api/client";
import type { JobResponse, RankingResponse } from "@/lib/api/types";
import { formatDate, truncate } from "@/lib/utils";

type SortKey = "rank" | "score" | "name";

export function RankingBoard(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const jobId = Number(id);
  useDocumentTitle("Candidate Ranking");
  const navigate = useNavigate();
  const { setActiveJob } = useActiveJob();
  const [job, setJob] = useState<JobResponse | null>(null);
  const [ranking, setRanking] = useState<RankingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>("rank");
  const [matchConfirm, setMatchConfirm] = useState(false);
  const [matchRunning, setMatchRunning] = useState(false);
  const [candidatesCount, setCandidatesCount] = useState<number>(0);

  const load = async (): Promise<void> => {
    if (!jobId) return;
    setLoading(true);
    try {
      const [j, r, cRes] = await Promise.all([
        api.getJob(jobId).catch(() => null),
        api.getRanking(jobId).catch(() => null),
        api.listCandidates({ job_id: jobId, limit: 1 }).catch(() => ({ candidates: [], total: 0 })),
      ]);
      if (j) {
        setJob(j);
        setActiveJob(j);
      }
      setRanking(r);
      setCandidatesCount(cRes.total ?? cRes.candidates.length ?? 0);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Failed to load ranking.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [jobId]);

  const sortedList = useMemo(() => {
    const list = ranking?.ranked_candidates ?? [];
    const copy = [...list];
    if (sort === "score") copy.sort((a, b) => b.overall_score - a.overall_score);
    else if (sort === "name") copy.sort((a, b) => (a.candidate_name ?? "").localeCompare(b.candidate_name ?? ""));
    else copy.sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999));
    return copy;
  }, [ranking, sort]);

  const runMatch = async (): Promise<void> => {
    if (!jobId) return;
    setMatchRunning(true);
    try {
      await api.runMatch({ job_id: jobId, rerun: true });
      toast.success("Matching complete — ranking refreshed");
      await load();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Match failed.";
      toast.error(msg);
    } finally {
      setMatchRunning(false);
      setMatchConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <HudSkeleton lines={3} className="h-24" />
        <HudSkeleton lines={12} className="h-[600px" />
      </div>
    );
  }

  const hasRanking = (ranking?.ranked_candidates?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="hud-label">CANDIDATE RANKING // RECRUITMENT HUD</p>
          <h1 className="mt-1 text-3xl font-bold neon-text">
            {job?.title ?? "Job"} — Ranking Board
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <HudBadge tone="violet" dot>
              {ranking ? `${ranking.total ?? 0} ranked` : "Loading…"}
            </HudBadge>
            {job?.min_experience_years != null && (
              <HudBadge tone="cyan">Min {job.min_experience_years} yrs exp</HudBadge>
            )}
            {job?.required_education && (
              <HudBadge tone="neutral">{truncate(job.required_education, 40)}</HudBadge>
            )}
            {job?.created_at && (
              <HudBadge tone="neutral">Created {formatDate(job.created_at)}</HudBadge>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <NeonButton variant="secondary" onClick={() => navigate(`/jobs/${jobId}`)}>
          ← Back to Job
          </NeonButton>
          <NeonButton variant="ghost" onClick={() => void load()}>
            Refresh
          </NeonButton>
          <NeonButton
            variant="primary"
          onClick={() => setMatchConfirm(true)}
          loading={matchRunning}
          >
            {hasRanking ? "Re-run Matching" : "Run Matching"}
          </NeonButton>
        </div>
      </div>

      {!hasRanking ? (
        <HudCard glow="amber" cornerBrackets className="p-10 text-center">
          <p className="hud-label">NO RANKING YET</p>
          <h3 className="mt-2 text-2xl font-bold neon-text--amber">No candidates ranked</h3>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-c-text-dim">
            {candidatesCount > 0
              ? `${candidatesCount} candidate(s) uploaded but matching has not been run yet. Click Run Matching to compute weighted scores (Required Skills 40%, Experience 25%, Projects 20%, Education/Cert 10%, Additional Skills 5%).`
              : "Upload resumes first, then run semantic matching to compute ranks."}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <NeonButton variant="primary" onClick={() => navigate(`/jobs/${jobId}/upload`)}>
              Upload Resumes
            </NeonButton>
            {candidatesCount > 0 && (
              <NeonButton variant="secondary" onClick={() => setMatchConfirm(true)} loading={matchRunning}>
                Run Matching Now
              </NeonButton>
            )}
          </div>
        </HudCard>
      ) : (
        <>
          <HudCard cornerBrackets glow="cyan">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="hud-label">SORT</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {(
                  [
                    { k: "rank", l: "Rank" },
                    { k: "score", l: "Score" },
                    { k: "name", l: "Name" },
                  ] as { k: SortKey; l: string }[]
                ).map((o) => (
                  <button
                    key={o.k}
                    onClick={() => setSort(o.k)}
                    className={`hud-chip hud-chip--violet !cursor-pointer transition hover:shadow-neon-violet ${
                      sort === o.k ? "!bg-c-violet/30" : ""
                    }`}
                  >
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <HudBadge tone="match" dot>
                Top Score: {(sortedList[0]?.overall_score ?? 0).toFixed(0)}%
              </HudBadge>
              <HudBadge tone="warn" dot>
                Avg:{" "}
                {(
                  sortedList.reduce((s, r) => s + r.overall_score, 0) / Math.max(1, sortedList.length)
                ).toFixed(0)}
                %
              </HudBadge>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-c-violet/30 text-left text-c-text-dim">
                  <th className="py-3 pr-3 font-semibold uppercase tracking-wider">Rank</th>
                  <th className="py-3 pr-3 font-semibold uppercase tracking-wider">Candidate</th>
                  <th className="py-3 pr-3 font-semibold uppercase tracking-wider">Score</th>
                  <th className="py-3 pr-3 font-semibold uppercase tracking-wider">Category Breakdown</th>
                  <th className="py-3 pr-3 font-semibold uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedList.map((row, idx) => (
                  <tr
                    key={row.candidate_id}
                    className="border-b border-c-violet/15 hover:bg-c-cyan/5 transition"
                  >
                    <td className="py-4 pr-3 align-top">
                      <div className="flex items-center gap-2">
                        <span
                          className={`flex h-9 w-9 items-center justify-center rounded-md text-lg font-bold tabular-nums ${
                            idx === 0
                              ? "bg-gradient-to-br from-c-amber/20 to-c-magenta/10 text-c-amber shadow-neon-amber"
                              : idx === 1
                                ? "bg-c-cyan/10 text-c-cyan-2"
                                : idx === 2
                                  ? "bg-c-violet/10 text-c-violet"
                                  : "bg-c-text-dim/10 text-c-text-dim"
                          }`}
                        >
                          {idx === 0 ? "👑" : row.rank ?? idx + 1}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 pr-3 align-top">
                      <div>
                        <Link
                          to={`/candidates/${row.candidate_id}`}
                          className="font-bold text-c-text-main hover:underline decoration-c-cyan/60 hover:decoration-c-cyan"
                        >
                          {row.candidate_name ?? `Candidate #${row.candidate_id}`}
                        </Link>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {row.skill_gap?.matching_skills?.slice?.(0, 4).map((s) => (
                            <HudBadge key={s} tone="match" className="!text-[0.65rem]">
                              {truncate(s, 18)}
                            </HudBadge>
                          )) ?? null}
                          {row.skill_gap?.missing_skills?.slice?.(0, 2).map((s) => (
                            <HudBadge key={s} tone="missing" className="!text-[0.65rem]">
                              missing {truncate(s, 14)}
                            </HudBadge>
                          )) ?? null}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 pr-3 align-top">
                      <div className="flex items-center gap-3">
                        <ScoreRing score={row.overall_score} size={72} strokeWidth={8} />
                        <div>
                          <div className="text-xl font-bold tabular-nums neon-text">
                            {row.overall_score.toFixed(0)}
                          </div>
                          <p className="text-xs text-c-text-dim">/100 match</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 pr-3 align-top">
                      <div className="space-y-2 min-w-[280px]">
                        <CategoryBar
                          label="Required Skills"
                          weightLabel="40%"
                          score={row.scores.required_skills_score}
                          tone="cyan"
                          compact
                        />
                        <CategoryBar
                          label="Experience"
                          weightLabel="25%"
                          score={row.scores.experience_score}
                          tone="violet"
                          compact
                        />
                        <CategoryBar
                          label="Projects"
                          weightLabel="20%"
                          score={row.scores.projects_score}
                          tone="magenta"
                          compact
                        />
                        <CategoryBar
                          label="Education / Cert"
                          weightLabel="10%"
                          score={row.scores.education_cert_score}
                          tone="amber"
                          compact
                        />
                        <CategoryBar
                          label="Additional"
                          weightLabel="5%"
                          score={row.scores.additional_skills_score}
                          tone="green"
                          compact
                        />
                      </div>
                    </td>
                    <td className="py-4 pr-3 align-top text-right">
                      <NeonButton
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/jobs/${jobId}/match/${row.candidate_id}`)}
                      >
                        View Details →
                      </NeonButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </HudCard>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <HudCard cornerBrackets glow="green" className="p-5">
              <p className="hud-label">MATCHING METHODOLOGY</p>
              <h3 className="mt-1 font-bold neon-text--green">Weighted Scoring</h3>
              <ul className="mt-3 space-y-1.5 text-sm text-c-text-dim">
                <li>• <span className="text-c-cyan-2 font-semibold">Required Skills (40%)</span> — semantic embedding match, threshold 0.68</li>
                <li>• <span className="text-c-violet font-semibold">Relevant Experience (25%)</span> — years ratio + semantic text overlap</li>
                <li>• <span className="text-c-magenta font-semibold">Projects (20%)</span> — top-N weighted + count bonus</li>
                <li>• <span className="text-c-amber font-semibold">Education / Cert (10%)</span> — level points + required-edu boost</li>
                <li>• <span className="text-c-green font-semibold">Additional Skills (5%)</span> — nice-to-have + bonus skills</li>
              </ul>
            </HudCard>
            <HudCard cornerBrackets glow="magenta" className="p-5">
              <p className="hud-label">SKILL GAP</p>
              <h3 className="mt-1 font-bold neon-text--magenta">Matching vs Missing</h3>
              <p className="mt-3 text-sm leading-relaxed text-c-text-dim">
                Each candidate&apos;s skills are compared against required skills using embeddings. Matches
                ≥0.85 count as matching; 0.68–0.85 count as <em className="text-c-amber">weak/missing</em>
                (partial coverage, shows the semantic relatives).
              </p>
            </HudCard>
            <HudCard cornerBrackets glow="amber" className="p-5">
              <p className="hud-label">NEXT STEPS</p>
              <h3 className="mt-1 font-bold neon-text--amber">Recruiter Actions</h3>
              <div className="mt-3 flex flex-col gap-2">
                <NeonButton
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate(`/jobs/${jobId}/match/${sortedList[0]?.candidate_id}`)}
                  disabled={sortedList.length === 0}
                >
                  Review Top Candidate →
                </NeonButton>
                <NeonButton variant="ghost" size="sm" onClick={() => navigate(`/candidates?job_id=${jobId}`)}>
                  Browse All Candidates
                </NeonButton>
                <NeonButton variant="ghost" size="sm" onClick={() => navigate(`/jobs/${jobId}/upload`)}>
                  + Add More Resumes
                </NeonButton>
              </div>
            </HudCard>
          </div>
        </>
      )}

      <ConfirmModal
        open={matchConfirm}
        onClose={() => setMatchConfirm(false)}
        onConfirm={() => void runMatch()}
        loading={matchRunning}
        title={hasRanking ? "Re-run Semantic Matching" : "Run Semantic Matching"}
        description={`Will compute weighted scores for candidates using embeddings + LLM explanations. This may take a few seconds.`}
        confirmLabel={hasRanking ? "Re-run Matching" : "Run Matching"}
      />
    </div>
  );
}
