import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { HudCard } from "@/components/ui/HudCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { HudBadge } from "@/components/ui/HudBadge";
import { HudSkeleton } from "@/components/ui/HudSkeleton";
import { HudProgress } from "@/components/ui/HudProgress";
import { ConfirmModal } from "@/components/common/Modals";
import { useActiveJob } from "@/context/AppContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { api, ApiError } from "@/lib/api/client";
import type {
  CandidateResponse,
  CandidateUploadResponse,
  InfoResponse,
  JobResponse,
} from "@/lib/api/types";
import { cn, formatBytes, truncate } from "@/lib/utils";

type FileItem = {
  id: string;
  file: File;
  status: "idle" | "uploading" | "success" | "error";
  progress: number;
  error?: string;
  candidate?: CandidateResponse;
};

export function UploadResumes(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const jobId = Number(id);
  useDocumentTitle("Upload Resumes");
  const navigate = useNavigate();
  const { setActiveJob } = useActiveJob();
  const [job, setJob] = useState<JobResponse | null>(null);
  const [info, setInfo] = useState<InfoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [matchConfirm, setMatchConfirm] = useState(false);
  const [matchRunning, setMatchRunning] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [summary, setSummary] = useState<CandidateUploadResponse | null>(null);
  const successCount = items.filter((i) => i.status === "success").length;
  const errorCount = items.filter((i) => i.status === "error").length;

  const load = async (): Promise<void> => {
    if (!jobId) return;
    setLoading(true);
    try {
      const [j, iRes] = await Promise.all([api.getJob(jobId), api.getInfo()]);
      setJob(j);
      setInfo(iRes);
      setActiveJob(j);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Failed to load.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [jobId]);

  const onDrop = useCallback(
    (files: File[]) => {
      if (!jobId) return;
      const next: FileItem[] = files.map((f) => ({
        id: `${f.name}-${f.size}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        file: f,
        status: "idle",
        progress: 0,
      }));
      setItems((prev) => [...prev, ...next]);
      setSummary(null);
    },
    [jobId],
  );

  const acceptObj = useMemo(() => {
    const accept: Record<string, string[]> = {};
    for (const ext of info?.allowed_extensions ?? [".pdf", ".docx", ".txt"]) {
      if (ext === ".pdf") accept["application/pdf"] = [".pdf"];
      if (ext === ".docx")
        accept["application/vnd.openxmlformats-officedocument.wordprocessingml.document"] = [".docx"];
      if (ext === ".txt") accept["text/plain"] = [".txt"];
    }
    return accept;
  }, [info]);

  const { getRootProps, getInputProps, isDragActive, isDragReject, fileRejections, open } =
    useDropzone({
      onDrop,
      accept: Object.keys(acceptObj).length ? acceptObj : undefined,
      maxSize: (info?.max_upload_mb ?? 15) * 1024 * 1024,
      noClick: true,
    });

  const handleZoneClick = useCallback(
    (e?: React.MouseEvent | Event): void => {
      e?.stopPropagation?.();
      e?.preventDefault?.();
      if (inputRef.current) {
        inputRef.current.click();
      } else {
        open();
      }
    },
    [open],
  );

  useEffect(() => {
    if (fileRejections.length > 0) {
      for (const rej of fileRejections) {
        for (const err of rej.errors) {
          if (err.code === "file-too-large") {
            toast.error(`File too large (>${info ? ` (${info.max_upload_mb}MB limit)` : ""}: ${rej.file.name}`);
          } else if (err.code === "file-invalid-type") {
            toast.error(`Unsupported format: ${rej.file.name}`);
          } else {
            toast.error(`${err.message}: ${rej.file.name}`);
          }
        }
      }
    }
  }, [fileRejections, info]);

  const removeItem = (id: string): void => {
    if (uploading) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const doUpload = async (): Promise<void> => {
    if (!jobId || items.length === 0) return;
    setUploading(true);
    setSummary(null);
    const toUpload = items.filter((i) => i.status === "idle" || i.status === "error");
    if (toUpload.length === 0) {
      setUploading(false);
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        toUpload.find((x) => x.id === i.id)
          ? { ...i, status: "uploading", progress: 8, error: undefined }
          : i,
      ),
    );
    const files = toUpload.map((i) => i.file);
    let resp: CandidateUploadResponse;
    try {
      resp = await api.uploadResumes(jobId, files);
      // simulate progress bar (best effort
      for (let p = 10; p <= 95; p += 22) {
        await new Promise((r) => setTimeout(r, 120));
        setItems((prev) =>
          prev.map((i) =>
            toUpload.find((x) => x.id === i.id) ? { ...i, progress: p } : i,
          ),
        );
      }
      // assign results by filename (matching order
      setItems((prev) => {
        const next = [...prev];
        let ci = 0;
        for (let i = 0; i < next.length; i++) {
          if (!toUpload.find((x) => x.id === next[i].id)) continue;
          const cand = resp.candidates[ci];
          const err = resp.errors[ci];
          if (cand) {
            next[i] = { ...next[i], status: "success", progress: 100, candidate: cand };
          } else if (err && err.file === next[i].file.name) {
            next[i] = { ...next[i], status: "error", progress: 0, error: err.error };
          } else {
            // fallback: try to match by name or just use remaining errors in order
            const errByIndex = resp.errors[resp.candidates.length > 0 ? ci - resp.candidates.length : ci];
            next[i] = {
              ...next[i],
              status: errByIndex ? "error" : "success",
              progress: errByIndex ? 0 : 100,
              error: errByIndex?.error,
              candidate: !errByIndex ? cand : undefined,
            };
          }
          ci++;
        }
        return next;
      });
      setSummary(resp);
      if (resp.success) {
        toast.success(resp.message);
      } else if (resp.candidates.length > 0) {
        toast.warning(resp.message);
      } else {
        toast.error(resp.message);
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Upload failed.";
      toast.error(msg);
      setItems((prev) =>
        prev.map((i) =>
          toUpload.find((x) => x.id === i.id) ? { ...i, status: "error", error: msg } : i,
        ),
      );
    } finally {
      setUploading(false);
    }
  };

  const runMatch = async (): Promise<void> => {
    if (!jobId) return;
    setMatchRunning(true);
    try {
      await api.runMatch({ job_id: jobId, rerun: true });
      toast.success("Matching completed");
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
        <HudSkeleton lines={2} style={{ height: 120 }} />
        <HudSkeleton lines={6} style={{ height: 280 }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="hud-label">
            <Link to="/jobs" className="hover:text-c-cyan">Jobs</Link>
            <span className="mx-2 text-c-text-dim">/</span>
            {job ? <Link to={`/jobs/${job.id}`} className="hover:text-c-cyan">{truncate(job.title, 40)}</Link> : "Unknown"}
            <span className="mx-2 text-c-text-dim">/</span>
            <span className="text-c-text-main">Upload Resumes</span>
          </div>
          <h1 className="mt-1 text-3xl font-black tracking-tight">
            <span className="neon-text--magenta">Upload Resumes</span>
            {job && (
              <span className="ml-4 text-lg font-normal text-c-text-dim">
                for <span className="text-c-text-main">{job.title}</span>
              </span>
            )}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {info && (
            <HudBadge tone="violet" className="hidden sm:inline-flex">
              {info.allowed_extensions.join(" · ")} · Max {info.max_upload_mb}MB
            </HudBadge>
          )}
          <Link to={`/jobs/${jobId}`}>
            <NeonButton variant="ghost">← Back to Job</NeonButton>
          </Link>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <HudCard cornerBrackets glow="magenta" title="Dropzone" subtitle="Drag and drop resume files or click to browse">
            <div
              {...getRootProps({ onClick: handleZoneClick })}
              className={cn(
                "cursor-pointer rounded-xl border-2 border-dashed px-6 py-14 text-center transition-all",
                isDragActive && !isDragReject && "border-c-cyan bg-c-cyan/[0.08] shadow-neon-cyan",
                isDragReject && "border-c-red bg-c-red/[0.08] animate-pulse",
                !isDragActive && !isDragReject && "border-c-border-soft hover:border-c-magenta/70 bg-white/[0.015]",
              )}
            >
              <input {...getInputProps()} ref={inputRef} />
              <div className="text-5xl mb-3">⬆</div>
              {isDragActive ? (
                <div>
                  <div className="text-xl font-bold neon-text">Drop files to upload</div>
                  <p className="mt-1 text-sm text-c-text-dim">Release files to begin the upload queue.</p>
                </div>
              ) : (
                <div>
                  <div className="text-xl font-bold text-c-text-main">
                    Drag &amp; drop resumes here, or{" "}
                    <span className="neon-text--cyan underline underline-offset-2">click to browse</span>
                  </div>
                  <p className="mt-2 text-sm text-c-text-dim">
                    Supports PDF, DOCX, TXT. Max {(info?.max_upload_mb ?? 15)}MB per file.
                  </p>
                </div>
              )}
            </div>
          </HudCard>

          <HudCard
            cornerBrackets
            soft
            glow="cyan"
            title="Upload Queue"
            subtitle={`${items.length} file${items.length === 1 ? "" : "s"} · ${successCount} succeeded · ${errorCount} failed`}
            actions={
              items.length > 0 && (
                <div className="flex gap-2">
                  <NeonButton variant="ghost" size="sm" onClick={() => !uploading && setItems([])} disabled={uploading}>
                    Clear
                  </NeonButton>
                  <NeonButton variant="primary" size="sm" loading={uploading} onClick={() => void doUpload()} disabled={uploading || items.length === 0 || !jobId}>
                    {uploading ? "Uploading..." : "Upload to Job"}
                  </NeonButton>
                </div>
              )
            }
          >
            {items.length === 0 ? (
              <div className="text-center py-10 text-c-text-dim text-sm">
                No files in the queue yet. Add some above.
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((it) => (
                  <div
                    key={it.id}
                    className={cn(
                      "rounded-xl p-4 border transition-all",
                      it.status === "success" && "border-c-green/40 bg-c-green/[0.04]",
                      it.status === "error" && "border-c-red/40 bg-c-red/[0.05]",
                      it.status === "uploading" && "border-c-cyan/50 bg-c-cyan/[0.05]",
                      it.status === "idle" && "border-c-border-soft bg-white/[0.02]",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-c-text-main">{it.file.name}</div>
                        <div className="text-xs text-c-text-dim mt-0.5">
                          {formatBytes(it.file.size)}
                          {it.candidate?.profile.name && (
                            <>
                              <span className="mx-1.5 text-c-border-soft">·</span>
                              <span className="text-c-cyan-2">{it.candidate.profile.name}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusPill status={it.status} />
                        <button
                          onClick={() => removeItem(it.id)}
                          className="text-c-text-dim hover:text-c-red text-sm"
                          disabled={uploading}
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    {(it.status === "uploading" || it.status === "success") && (
                      <div className="mt-3">
                        <HudProgress value={it.progress} showLabel />
                      </div>
                    )}
                    {it.error && (
                      <div className="mt-2 text-xs text-c-red leading-relaxed">
                        <b>Error:</b> {it.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </HudCard>
        </div>

        <div className="space-y-4">
          <HudCard cornerBrackets glow="cyan" title="Summary">
            {summary ? (
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-c-text-dim">Total processed</span>
                  <HudBadge tone="violet">{summary.candidates.length + summary.errors.length}</HudBadge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-c-text-dim">Succeeded</span>
                  <HudBadge tone="match" dot>{summary.candidates.length}</HudBadge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-c-text-dim">Errors</span>
                  <HudBadge tone="missing" dot>{summary.errors.length}</HudBadge>
                </div>
                <div className="hud-divider my-2" />
                <p className="text-c-text-main leading-relaxed">{summary.message}</p>
              </div>
            ) : (
              <p className="text-sm text-c-text-dim">
                Upload a batch to see per-file outcomes and a quick links to the next steps.
              </p>
            )}
          </HudCard>

          <HudCard cornerBrackets soft glow="amber" title="Next Steps">
            <div className="space-y-2">
              <Link to={`/candidates?job_id=${jobId}`}>
                <NeonButton variant="secondary" className="w-full justify-start">
                  ◉ View Candidates
                </NeonButton>
              </Link>
              <NeonButton
                variant="primary"
                className="w-full justify-start"
                onClick={() => successCount === 0 ? toast("Upload & process resumes first") : setMatchConfirm(true)}
              >
                ⚙ Run Matching
              </NeonButton>
              <Link to={`/jobs/${jobId}/ranking`}>
                <NeonButton variant="ghost" className="w-full justify-start">
                  📊 View Ranking
                </NeonButton>
              </Link>
            </div>
          </HudCard>
        </div>
      </div>

      <ConfirmModal
        open={matchConfirm}
        loading={matchRunning}
        title="Run Semantic Matching"
        description={`Run matching for ${successCount} candidate${successCount === 1 ? "" : "s"}. This computes weighted scoring, skill gaps, and AI explanations.`}
        confirmLabel="Run Matching"
        onClose={() => !matchRunning && setMatchConfirm(false)}
        onConfirm={() => void runMatch()}
      />
    </div>
  );
}

function StatusPill({ status }: { status: FileItem["status"] }): JSX.Element {
  if (status === "idle") return <HudBadge tone="neutral">Queued</HudBadge>;
  if (status === "uploading") return <HudBadge tone="cyan" dot>Uploading…</HudBadge>;
  if (status === "success") return <HudBadge tone="match" dot>Success</HudBadge>;
  return <HudBadge tone="missing" dot>Error</HudBadge>;
}
