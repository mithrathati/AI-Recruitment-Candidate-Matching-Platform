import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { HudCard } from "@/components/ui/HudCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { HudBadge } from "@/components/ui/HudBadge";
import { HudSkeleton } from "@/components/ui/HudSkeleton";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { useActiveJob } from "@/context/AppContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { api, ApiError } from "@/lib/api/client";
import type {
  CandidateResponse,
  JobResponse,
  MatchResultResponse,
} from "@/lib/api/types";
import { formatDate, truncate } from "@/lib/utils";

export function CandidateProfile(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const cid = Number(id);
  useDocumentTitle("Candidate Profile");
  const navigate = useNavigate();
  const { setActiveJob } = useActiveJob();
  const [cand, setCand] = useState<CandidateResponse | null>(null);
  const [job, setJob] = useState<JobResponse | null>(null);
  const [match, setMatch] = useState<MatchResultResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async (): Promise<void> => {
    if (!cid) return;
    setLoading(true);
    try {
      const c = await api.getCandidate(cid);
      setCand(c);
      const [j, mRes] = await Promise.all([
        api.getJob(c.job_id),
        api.getRanking(c.job_id).then(
          (r) => r.ranked_candidates.find((x) => x.candidate_id === c.id) ?? null,
        ).catch(() => null),
      ]);
      setJob(j);
      setActiveJob(j);
      setMatch(mRes);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Failed to load candidate.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [cid]);

  if (loading || !cand) {
    return (
      <div className="space-y-6">
        <HudSkeleton lines={3} style={{ height: 180 }} />
        <div className="grid md:grid-cols-2 gap-4">
          <HudSkeleton lines={5} style={{ height: 260 }} />
          <HudSkeleton lines={5} style={{ height: 260 }} />
        </div>
      </div>
    );
  }

  const p = cand.profile;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="hud-label">
            <Link to="/candidates" className="hover:text-c-cyan">Candidates</Link>
            <span className="mx-2 text-c-text-dim">/</span>
            <span className="text-c-text-main">#{cand.id}</span>
          </div>
          <h1 className="mt-1 text-3xl md:text-4xl font-black tracking-tight">
            <span className="neon-text">{p.name ?? "Unknown Candidate"}</span>
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-c-text-dim">
            {p.email && <span className="hud-chip hud-chip--neutral">✉ {p.email}</span>}
            {p.phone && <span className="hud-chip hud-chip--neutral">☏ {p.phone}</span>}
            <span className="hud-chip hud-chip--neutral">📄 {truncate(cand.resume_file_name, 30)}</span>
            <span className="hud-chip hud-chip--neutral">🕒 {formatDate(cand.created_at)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {match && job && (
            <Link to={`/jobs/${job.id}/match/${cand.id}`}>
              <NeonButton variant="primary" size="lg">View Match Detail</NeonButton>
            </Link>
          )}
          {job && (
            <Link to={`/jobs/${job.id}`}>
              <NeonButton variant="ghost">← Back to Job</NeonButton>
            </Link>
          )}
        </div>
      </header>

      <div className="grid lg:grid-cols-4 gap-4">
        <HudCard cornerBrackets glow="magenta" className="lg:col-span-1" title="Match Snapshot">
          <div className="flex flex-col items-center text-center">
            {match ? (
              <>
                <ScoreRing score={match.overall_score} size={180} />
                <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                  {match.rank != null && <HudBadge tone="violet">Rank #{match.rank}</HudBadge>}
                  <HudBadge tone="match" dot>{p.experience_years ?? 0}+ yrs</HudBadge>
                </div>
              </>
            ) : (
              <>
                <ScoreRing score={0} size={180} />
                <div className="mt-3 text-sm text-c-text-dim">
                  Not yet matched
                </div>
                <div className="mt-2">
                  {job && (
                    <Link to={`/jobs/${job.id}`}>
                      <NeonButton variant="secondary" size="sm">Run Matching</NeonButton>
                    </Link>
                  )}
                </div>
              </>
            )}
          </div>
          {job && (
            <div className="mt-5 pt-5 border-t border-c-border-soft space-y-2">
              <div>
                <div className="hud-label">SOURCE JOB</div>
                <Link to={`/jobs/${job.id}`} className="mt-1 font-semibold text-c-cyan hover:underline truncate block">
                  {job.title}
                </Link>
              </div>
              <div>
                <div className="hud-label">YEARS EXPERIENCE</div>
                <div className="mt-1 font-semibold">{p.experience_years ?? "Not extracted"}</div>
              </div>
            </div>
          )}
        </HudCard>

        <div className="lg:col-span-3 space-y-4">
          <HudCard cornerBrackets glow="cyan" title="Skills" subtitle={`${p.skills.length} total extracted skills`}>
            <div className="flex flex-wrap gap-2">
              {p.skills.length === 0 ? (
              <span className="text-sm text-c-text-dim">No skills extracted.</span>
            ) : (
              p.skills.map((s) => <HudBadge key={s} tone="match">{s}</HudBadge>)
            )}
            </div>
            {p.additional_skills.length > 0 && (
              <>
                <div className="hud-divider my-4" />
                <div className="hud-label mb-2">ADDITIONAL SKILLS</div>
                <div className="flex flex-wrap gap-2">
                  {p.additional_skills.map((s) => (
                    <HudBadge key={s} tone="neutral">{s}</HudBadge>
                  ))}
                </div>
              </>
            )}
          </HudCard>

          <HudCard cornerBrackets glow="violet" title="Experience" subtitle={p.experience_years != null ? `${p.experience_years} years total` : undefined}>
            {p.experience_summary ? (
              <p className="text-c-text-main/90 leading-relaxed whitespace-pre-wrap">
                {p.experience_summary}
              </p>
            ) : (
              <p className="text-sm text-c-text-dim">No experience summary extracted.</p>
            )}
          </HudCard>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <HudCard
          cornerBrackets
          soft
          glow="amber"
          title="Education"
          subtitle={`${p.education.length} entr${p.education.length === 1 ? "y" : "ies"}`}
        >
          {p.education.length === 0 ? (
            <p className="text-sm text-c-text-dim">No education entries extracted.</p>
          ) : (
            <div className="space-y-3">
              {p.education.map((e, idx) => {
                const degree = String((e as Record<string, unknown>).degree ?? String((e as Record<string, unknown>).name ?? String(e)));
                const school = String((e as Record<string, unknown>).school ?? "");
                const year = String((e as Record<string, unknown>).year ?? "");
                return (
                  <div key={idx} className="rounded-xl p-4 border border-c-border-soft bg-white/[0.02]">
                    <div className="font-bold text-c-text-main">{truncate(String(degree), 140)}</div>
                    {(school || year) && (
                      <div className="mt-1 text-xs text-c-text-dim flex flex-wrap gap-2">
                        {school && <span>🏫 {school}</span>}
                        {year && <span>🎓 {year}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </HudCard>

        <HudCard cornerBrackets soft glow="green" title="Certifications" subtitle={`${p.certifications.length} certification${p.certifications.length === 1 ? "" : "s"}`}>
          {p.certifications.length === 0 ? (
            <p className="text-sm text-c-text-dim">No certifications extracted.</p>
          ) : (
            <ul className="space-y-2">
              {p.certifications.map((c, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="hud-chip hud-chip--warn">🏆</span>
                  <span className="text-c-text-main/90">{c}</span>
                </li>
              ))}
            </ul>
          )}
        </HudCard>
      </div>

      <HudCard
        cornerBrackets
        glow="cyan"
        title="Projects"
        subtitle={`${p.projects.length} project${p.projects.length === 1 ? "" : "s"} extracted`}
      >
        {p.projects.length === 0 ? (
          <p className="text-sm text-c-text-dim">No projects extracted.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {p.projects.map((pr, idx) => {
              const title = String((pr as Record<string, unknown>).title ?? `Project ${idx + 1}`);
              const desc = String((pr as Record<string, unknown>).description ?? "");
              return (
                <div key={idx} className="rounded-xl p-5 border border-c-border-soft bg-white/[0.02]">
                  <div className="font-bold text-c-text-main neon-text--cyan">{title}</div>
                  {desc && (
                    <p className="mt-2 text-sm text-c-text-dim leading-relaxed whitespace-pre-wrap">{desc}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </HudCard>
    </div>
  );
}
