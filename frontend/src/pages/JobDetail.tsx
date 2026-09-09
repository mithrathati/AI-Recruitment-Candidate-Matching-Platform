import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { HudCard } from "@/components/ui/HudCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { HudBadge } from "@/components/ui/HudBadge";
import { HudSkeleton } from "@/components/ui/HudSkeleton";
import { CategoryBar } from "@/components/ui/CategoryBar";
import { ConfirmModal } from "@/components/common/Modals";
import { useActiveJob } from "@/context/AppContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { api, ApiError } from "@/lib/api/client";
import type { CandidateResponse, JobResponse } from "@/lib/api/types";
import { formatDate, truncate } from "@/lib/utils";

export function JobDetail(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const jobId = Number(id);
  useDocumentTitle("Job Details");
  const navigate = useNavigate();
  const { setActiveJob } = useActiveJob();
  const [job, setJob] = useState<JobResponse | null>(null);
  const [candidates, setCandidates] = useState<CandidateResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [reExtracting, setReExtracting] = useState(false);
  const [matchConfirm, setMatchConfirm] = useState(false);
  const [matchRunning, setMatchRunning] = useState(false);

  const load = async (): Promise<void> => {
    if (!jobId) return;
    setLoading(true);
    try {
      const [j, c] = await Promise.all([
        api.getJob(jobId),
        api.listCandidates({ job_id: jobId, limit: 500 }),
      ]);
      setJob(j);
      setActiveJob(j);
      setCandidates(c.candidates);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Failed to load job.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [jobId]);

  const reExtract = async (): Promise<void> => {
    if (!jobId) return;
    setReExtracting(true);
    try {
      const j = await api.reExtractJob(jobId);
      setJob(j);
      toast.success("Requirements re-extracted successfully");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Re-extract failed.";
      toast.error(msg);
    } finally {
      setReExtracting(false);
    }
  };

  const runMatch = async (): Promise<void> => {
    if (!jobId) return;
    setMatchRunning(true);
    try {
      await api.runMatch({ job_id: jobId, rerun: true });
      toast.success("Matching completed successfully");
      navigate(`/jobs/${jobId}/ranking`);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Matching failed.";
      toast.error(msg);
    } finally {
      setMatchRunning(false);
      setMatchConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <HudSkeleton lines={3} style={{ height: 180 }} />
        <div className="grid md:grid-cols-3 gap-4">
          <HudSkeleton lines={5} style={{ height: 220 }} />
          <HudSkeleton lines={5} style={{ height: 220 }} />
          <HudSkeleton lines={5} style={{ height: 220 }} />
        </div>
      </div>
    );
  }
  if (!job) {
    return (
      <HudCard cornerBrackets glow="magenta">
        <div className="text-center py-8">
          <div className="hud-label">NOT FOUND</div>
          <h3 className="mt-2 text-lg font-bold">Job does not exist</h3>
          <div className="mt-4">
            <Link to="/jobs">
              <NeonButton>Back to Jobs</NeonButton>
            </Link>
          </div>
        </div>
      </HudCard>
    );
  }

  const reqSkills = job.required_skills ?? job.requirements?.required_skills ?? [];
  const niceSkills = job.nice_to_have_skills ?? job.requirements?.nice_to_have_skills ?? [];
  const requirementsExtracted = reqSkills.length > 0 || niceSkills.length > 0 || job.min_experience_years || job.required_education;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="hud-label">
            JOB #{job.id} · CREATED {formatDate(job.created_at)}
          </div>
          <h1 className="mt-1 text-3xl md:text-4xl font-black tracking-tight neon-text--cyan break-words">
            {job.title}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link to={`/jobs/${job.id}/upload`}>
            <NeonButton size="lg" variant="secondary">Upload Resumes</NeonButton>
          </Link>
          <NeonButton
            size="lg"
            variant="primary"
            onClick={() => candidates.length === 0 ? toast("Upload candidates first") : setMatchConfirm(true)}
          >
            Run Matching
          </NeonButton>
          <Link to={`/jobs/${job.id}/ranking`}>
            <NeonButton size="lg" variant="ghost">View Ranking</NeonButton>
          </Link>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <HudCard cornerBrackets glow="cyan" title="Job Description">
            <p className="whitespace-pre-wrap text-c-text-main/90 leading-relaxed">
              {job.description}
            </p>
          </HudCard>

          <HudCard
            cornerBrackets
            glow="violet"
            title={
              <span className="flex items-center gap-3">
                Extracted Requirements
                {!requirementsExtracted && (
                  <HudBadge tone="warn" dot>Not yet extracted</HudBadge>
                )}
              </span>
            }
            subtitle="Parsed from the JD using LLM + rule-based fallback pipeline"
            actions={
              <NeonButton variant="secondary" size="sm" loading={reExtracting} onClick={() => void reExtract()}>
                Re-extract Requirements
              </NeonButton>
            }
          >
            {!requirementsExtracted ? (
              <div className="text-sm text-c-text-dim">
                Requirements not yet extracted. Click <b>Re-extract Requirements</b> to trigger the extraction pipeline.
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <div className="hud-label mb-2">REQUIRED SKILLS</div>
                  <div className="flex flex-wrap gap-2">
                    {reqSkills.length === 0 ? (
                      <HudBadge tone="neutral">None extracted</HudBadge>
                    ) : (
                      reqSkills.map((s) => <HudBadge key={s} tone="match">{s}</HudBadge>)
                    )}
                  </div>
                </div>
                <div>
                  <div className="hud-label mb-2">NICE-TO-HAVE SKILLS</div>
                  <div className="flex flex-wrap gap-2">
                    {niceSkills.length === 0 ? (
                      <HudBadge tone="neutral">None listed</HudBadge>
                    ) : (
                      niceSkills.map((s) => <HudBadge key={s} tone="neutral">{s}</HudBadge>)
                    )}
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <div className="hud-label mb-2">MINIMUM EXPERIENCE</div>
                    <HudBadge tone="violet" dot>
                      {job.min_experience_years != null ? `${job.min_experience_years} years` : "No minimum specified"}
                    </HudBadge>
                  </div>
                  <div>
                    <div className="hud-label mb-2">REQUIRED EDUCATION</div>
                    <HudBadge tone="warn" dot>
                      {job.required_education ?? "No requirement specified"}
                    </HudBadge>
                  </div>
                </div>
                {job.requirements?.requirements_summary && (
                  <div>
                    <div className="hud-label mb-2">REQUIREMENTS SUMMARY</div>
                    <p className="text-sm text-c-text-dim leading-relaxed">{job.requirements.requirements_summary}</p>
                  </div>
                )}
              </div>
            )}
          </HudCard>

          <HudCard
            cornerBrackets
            soft
            glow="cyan"
            title="Candidates Uploaded"
            subtitle={`${candidates.length} candidate${candidates.length === 1 ? "" : "s"} associated to this job`}
            actions={
              <Link to={`/jobs/${job.id}/upload`}>
                <NeonButton size="sm" variant="ghost">+ Upload More</NeonButton>
              </Link>
            }
          >
            {candidates.length === 0 ? (
              <div className="text-sm text-c-text-dim">
                No candidates yet. <Link to={`/jobs/${job.id}/upload`} className="text-c-cyan hover:underline">Upload Resumes →</Link>
              </div>
            ) : (
              <div className="divide-y divide-c-border-soft">
                {candidates.slice(0, 8).map((c) => (
                  <Link
                    key={c.id}
                    to={`/candidates/${c.id}`}
                    className="py-3 flex items-center justify-between gap-4 hover:bg-c-cyan/[0.04] px-2 -mx-2 rounded-lg transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-c-text-main truncate">
                        {c.profile.name ?? "Unknown Candidate"}
                      </div>
                      <div className="text-xs text-c-text-dim truncate">
                        {c.profile.email ?? "no email"} · {truncate(c.resume_file_name, 40)}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {c.profile.skills.slice(0, 5).map((s) => (
                          <HudBadge key={s} tone="match" className="!text-[0.65rem]">{s}</HudBadge>
                        ))}
                        {c.profile.skills.length > 5 && (
                          <HudBadge tone="neutral" className="!text-[0.65rem]">+{c.profile.skills.length - 5}</HudBadge>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <HudBadge tone="neutral" className="!text-[0.65rem]">#{c.id}</HudBadge>
                    </div>
                  </Link>
                ))}
                {candidates.length > 8 && (
                  <div className="pt-3 text-xs text-c-text-dim">
                    ...and {candidates.length - 8} more — view <Link to="/candidates" className="text-c-cyan hover:underline">all candidates →</Link>
                  </div>
                )}
              </div>
            )}
          </HudCard>
        </div>

        <div className="space-y-4">
          <HudCard
            cornerBrackets
            glow="magenta"
            title="At a Glance"
          >
            <div className="space-y-4">
              <CategoryBar label="Required Skills" score={Math.min(100, reqSkills.length * 6)} weightLabel={`${reqSkills.length} items`} tone="cyan" />
              <CategoryBar label="Nice-to-have" score={Math.min(100, niceSkills.length * 8)} weightLabel={`${niceSkills.length} items`} tone="violet" />
              <CategoryBar label="Candidates" score={Math.min(100, candidates.length * 8)} weightLabel={`${candidates.length} uploaded`} tone="magenta" compact />
            </div>
          </HudCard>

          <HudCard cornerBrackets soft glow="amber" title="Quick Links">
            <div className="space-y-2">
              <Link to={`/jobs/${job.id}/upload`}>
                <NeonButton variant="secondary" className="w-full justify-start">
                  ⬆ Upload Resumes
                </NeonButton>
              </Link>
              <NeonButton
                variant="primary"
                className="w-full justify-start"
                onClick={() => candidates.length === 0 ? toast("Upload candidates first") : setMatchConfirm(true)}
              >
                ⚙ Run Matching
              </NeonButton>
              <Link to={`/jobs/${job.id}/ranking`}>
                <NeonButton variant="ghost" className="w-full justify-start">
                  📊 View Ranking
                </NeonButton>
              </Link>
              <Link to={`/candidates?job_id=${job.id}`}>
                <NeonButton variant="ghost" className="w-full justify-start">
                  ◉ All Candidates
                </NeonButton>
              </Link>
            </div>
          </HudCard>
        </div>
      </div>

      <ConfirmModal
        open={matchConfirm}
        danger={false}
        loading={matchRunning}
        title="Run Semantic Matching"
        description={`Will match ${candidates.length} candidate${candidates.length === 1 ? "" : "s"} for "${truncate(job.title, 60)}". This computes embeddings, weighted 40/25/20/10/5 scoring, skill gaps, and AI explanations. It may take a few seconds.`}
        confirmLabel="Run Matching"
        onClose={() => !matchRunning && setMatchConfirm(false)}
        onConfirm={() => void runMatch()}
      />
    </div>
  );
}
