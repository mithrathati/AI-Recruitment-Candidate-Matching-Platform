import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { HudCard } from "@/components/ui/HudCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { HudBadge } from "@/components/ui/HudBadge";
import { HudSkeleton } from "@/components/ui/HudSkeleton";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { CategoryBar } from "@/components/ui/CategoryBar";
import { useActiveJob } from "@/context/AppContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { api, ApiError } from "@/lib/api/client";
import type { JobResponse, MatchResultResponse, RankingResponse } from "@/lib/api/types";

export function MatchDetail(): JSX.Element {
  const { id, candidateId } = useParams<{ id: string; candidateId: string }>();
  const jobId = Number(id);
  const cId = Number(candidateId);
  useDocumentTitle("Match Detail");
  const navigate = useNavigate();
  const { setActiveJob } = useActiveJob();
  const [job, setJob] = useState<JobResponse | null>(null);
  const [ranking, setRanking] = useState<RankingResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async (): Promise<void> => {
    if (!jobId) return;
    setLoading(true);
    try {
      const [j, r] = await Promise.all([api.getJob(jobId), api.getRanking(jobId)]);
      setJob(j);
      setActiveJob(j);
      setRanking(r);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Failed to load match.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [jobId, cId]);

  const ranked = ranking?.ranked_candidates ?? [];
  const currentIdx = useMemo(
    () => ranked.findIndex((r) => r.candidate_id === cId),
    [ranked, cId],
  );
  const match: MatchResultResponse | undefined = currentIdx >= 0 ? ranked[currentIdx] : undefined;

  if (loading) {
    return (
      <div className="space-y-6">
        <HudSkeleton lines={2} className="h-20" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <HudSkeleton lines={14} className="h-[620px]" />
          <HudSkeleton lines={14} className="h-[620px]" />
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="space-y-6">
        <HudCard glow="magenta" cornerBrackets className="p-10 text-center">
          <p className="hud-label">MATCH NOT FOUND</p>
          <h2 className="mt-2 text-2xl font-bold neon-text--magenta">No match result for this candidate</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-c-text-dim">
            Matching may not have been run for this job, or the candidate does not belong to this job.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <NeonButton variant="primary" onClick={() => navigate(`/jobs/${jobId}/ranking`)}>
              Back to Ranking
            </NeonButton>
            <NeonButton variant="secondary" onClick={() => navigate(`/jobs/${jobId}`)}>
              Go to Job
            </NeonButton>
          </div>
        </HudCard>
      </div>
    );
  }

  const prev = currentIdx > 0 ? ranked[currentIdx - 1] : null;
  const next = currentIdx < ranked.length - 1 ? ranked[currentIdx + 1] : null;
  const matchingSkills = match.skill_gap?.matching_skills ?? [];
  const missingSkills = match.skill_gap?.missing_skills ?? [];
  const strengths = match.strengths ?? [];
  const weaknesses = match.weaknesses ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="hud-label">MATCH ANALYSIS HUD</p>
          <h1 className="mt-1 text-3xl font-bold neon-text">
            {match.candidate_name ?? `Candidate #${match.candidate_id}`} — Suitability Report
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <HudBadge tone="violet" dot>
              Rank #{match.rank ?? currentIdx + 1} / {ranked.length}
            </HudBadge>
            <HudBadge tone="cyan">Job: {job?.title ?? `Job #${jobId}`}</HudBadge>
            <HudBadge tone="match">{matchingSkills.length} matching skills</HudBadge>
            {missingSkills.length > 0 && <HudBadge tone="missing">{missingSkills.length} missing/weak</HudBadge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <NeonButton variant="ghost" onClick={() => navigate(`/jobs/${jobId}`)}>
            ← Job
          </NeonButton>
          <NeonButton variant="secondary" onClick={() => navigate(`/jobs/${jobId}/ranking`)}>
            Ranking Board
          </NeonButton>
          <NeonButton variant="ghost" onClick={() => navigate(`/candidates/${match.candidate_id}`)}>
            Full Profile
          </NeonButton>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-2">
          <HudCard cornerBrackets glow={match.overall_score >= 85 ? "green" : match.overall_score >= 70 ? "cyan" : match.overall_score >= 55 ? "amber" : "magenta"} className="p-6 text-center">
            <p className="hud-label">OVERALL MATCH SCORE</p>
            <div className="mt-4 flex items-center justify-center gap-6">
              <div className="relative">
                <ScoreRing score={match.overall_score} size={220} strokeWidth={18} />
                {match.rank === 1 && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-4xl drop-shadow-[0_0_18px_rgba(255,176,0,0.8)]">
                    👑
                  </div>
                )}
              </div>
              <div className="text-left">
                <HudBadge tone="violet" dot>Ranked #{match.rank ?? currentIdx + 1}</HudBadge>
                <h2 className="mt-3 text-5xl font-black tabular-nums neon-text">
                  {match.overall_score.toFixed(0)}
                  <span className="text-2xl text-c-text-dim font-normal">/100</span>
                </h2>
                <p className="mt-2 max-w-[180px] text-sm text-c-text-dim leading-relaxed">
                  {match.overall_score >= 85
                    ? "Strong candidate — recommend interview."
                    : match.overall_score >= 70
                      ? "Good match — review profile."
                      : match.overall_score >= 55
                        ? "Partial fit — consider skill gaps."
                        : "Weak match — not recommended."}
                </p>
              </div>
            </div>
          </HudCard>

          <HudCard cornerBrackets glow="cyan" title="Score Breakdown" subtitle="Weighted 40 / 25 / 20 / 10 / 5">
            <div className="space-y-4">
              <CategoryBar
                label="Required Skills"
                weightLabel="40%"
                score={match.scores.required_skills_score}
                tone="cyan"
              />
              <CategoryBar
                label="Relevant Experience"
                weightLabel="25%"
                score={match.scores.experience_score}
                tone="violet"
              />
              <CategoryBar
                label="Projects"
                weightLabel="20%"
                score={match.scores.projects_score}
                tone="magenta"
              />
              <CategoryBar
                label="Education / Certifications"
                weightLabel="10%"
                score={match.scores.education_cert_score}
                tone="amber"
              />
              <CategoryBar
                label="Additional Skills"
                weightLabel="5%"
                score={match.scores.additional_skills_score}
                tone="green"
              />
              <div className="hud-divider my-2" />
              <div className="flex items-baseline justify-between">
                <span className="hud-label">WEIGHTED TOTAL</span>
                <span className="text-xl font-bold tabular-nums neon-text">
                  {(
                    match.scores.required_skills_score * 0.4 +
                    match.scores.experience_score * 0.25 +
                    match.scores.projects_score * 0.2 +
                    match.scores.education_cert_score * 0.1 +
                    match.scores.additional_skills_score * 0.05
                  ).toFixed(1)}
                  <span className="text-c-text-dim text-sm font-normal"> / 100</span>
                </span>
              </div>
            </div>
          </HudCard>

          <HudCard cornerBrackets glow="violet" title="Quick Navigation" subtitle="Jump between ranked candidates">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <NeonButton
                variant="ghost"
                size="sm"
                disabled={!prev}
                onClick={() => prev && navigate(`/jobs/${jobId}/match/${prev.candidate_id}`)}
              >
                ← #{prev?.rank ?? ""} {prev?.candidate_name ?? "Prev"}
              </NeonButton>
              <NeonButton
                variant="secondary"
                size="sm"
                onClick={() => navigate(`/jobs/${jobId}/ranking`)}
              >
                View All Ranks
              </NeonButton>
              <NeonButton
                variant="ghost"
                size="sm"
                disabled={!next}
                onClick={() => next && navigate(`/jobs/${jobId}/match/${next.candidate_id}`)}
              >
                #{next?.rank ?? ""} {next?.candidate_name ?? "Next"} →
              </NeonButton>
            </div>
          </HudCard>
        </div>

        <div className="space-y-6 lg:col-span-3">
          <HudCard cornerBrackets glow="cyan" title="Skill Gap Analysis" subtitle="Semantic match vs JD requirements">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="hud-label">MATCHING SKILLS</p>
                  <HudBadge tone="match" dot>{matchingSkills.length} found</HudBadge>
                </div>
                <div className="rounded-md border border-c-match/30 bg-c-match/5 p-4 min-h-[180px]">
                  {matchingSkills.length === 0 ? (
                    <p className="text-sm text-c-text-dim italic">No exact or strong semantic matches detected.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {matchingSkills.map((s) => (
                        <HudBadge key={s} tone="match" className="!py-1 !px-2.5 text-sm">
                          ✓ {s}
                        </HudBadge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="hud-label">MISSING / WEAK</p>
                  <HudBadge tone="missing" dot>{missingSkills.length} gaps</HudBadge>
                </div>
                <div className="rounded-md border border-c-red/30 bg-c-red/5 p-4 min-h-[180px]">
                  {missingSkills.length === 0 ? (
                    <p className="text-sm text-c-match font-semibold">— No major skill gaps detected —</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {missingSkills.map((s) => (
                        <HudBadge key={s} tone="missing" className="!py-1 !px-2.5 text-sm">
                          ✗ {s}
                        </HudBadge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </HudCard>

          <HudCard cornerBrackets glow="amber" title="AI Recruitment Analysis HUD" subtitle="LLM-generated explanation with fallback heuristics">
            <div className="space-y-5">
              <div className="rounded-md border border-c-amber/30 bg-c-amber/5 p-5">
                <p className="hud-label text-c-amber">EXPLANATION</p>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-c-text-main">
                  {match.explanation && match.explanation.trim().length > 0
                    ? match.explanation
                    : "Heuristic assessment: candidate scored " +
                      match.overall_score.toFixed(0) +
                      "% overall. Review category breakdown above for per-area performance."}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-md border border-c-match/30 bg-c-match/5 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-c-match">▲</span>
                    <p className="hud-label text-c-match">KEY STRENGTHS</p>
                  </div>
                  {strengths.length === 0 ? (
                    <p className="text-sm text-c-text-dim italic">No strengths flagged.</p>
                  ) : (
                    <ul className="space-y-2">
                      {strengths.map((s, i) => (
                        <li
                          key={i}
                          className="relative pl-4 text-sm leading-relaxed text-c-text-main before:absolute before:left-0 before:top-2 before:h-2 before:w-2 before:rounded-sm before:bg-c-match before:shadow-neon-green"
                        >
                          {s}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-md border border-c-red/30 bg-c-red/5 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-c-red">▼</span>
                    <p className="hud-label text-c-red">KEY WEAKNESSES / GAPS</p>
                  </div>
                  {weaknesses.length === 0 && missingSkills.length === 0 ? (
                    <p className="text-sm text-c-match font-semibold">— No weaknesses detected —</p>
                  ) : (
                    <ul className="space-y-2">
                      {weaknesses.map((w, i) => (
                        <li
                          key={i}
                          className="relative pl-4 text-sm leading-relaxed text-c-text-main before:absolute before:left-0 before:top-2 before:h-2 before:w-2 before:rounded-sm before:bg-c-red before:shadow-neon-red"
                        >
                          {w}
                        </li>
                      ))}
                      {weaknesses.length === 0 && missingSkills.length > 0 && (
                        <li className="relative pl-4 text-sm leading-relaxed text-c-text-main before:absolute before:left-0 before:top-2 before:h-2 before:w-2 before:rounded-sm before:bg-c-red before:shadow-neon-red">
                          Missing required skills: {missingSkills.slice(0, 5).join(", ")}
                          {missingSkills.length > 5 ? ` +${missingSkills.length - 5} more` : ""}.
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </HudCard>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link to={`/candidates/${match.candidate_id}`} className="text-sm text-c-cyan-2 hover:underline">
              → Open full candidate profile (projects, education, experience)
            </Link>
            <div className="flex items-center gap-2">
              {prev && (
                <NeonButton
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/jobs/${jobId}/match/${prev.candidate_id}`)}
                >
                  ← Previous Candidate
                </NeonButton>
              )}
              {next && (
                <NeonButton
                  variant="primary"
                  size="sm"
                  onClick={() => navigate(`/jobs/${jobId}/match/${next.candidate_id}`)}
                >
                  Next Candidate →
                </NeonButton>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
