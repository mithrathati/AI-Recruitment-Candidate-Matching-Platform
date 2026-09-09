import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { AppShell } from "@/components/layout/AppShell";
import { HudSkeleton } from "@/components/ui/HudSkeleton";

const Dashboard = lazy(() => import("@/pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const JobsList = lazy(() => import("@/pages/JobsList").then((m) => ({ default: m.JobsList })));
const JobDetail = lazy(() => import("@/pages/JobDetail").then((m) => ({ default: m.JobDetail })));
const UploadResumes = lazy(() => import("@/pages/UploadResumes").then((m) => ({ default: m.UploadResumes })));
const CandidatesList = lazy(() => import("@/pages/CandidatesList").then((m) => ({ default: m.CandidatesList })));
const CandidateProfile = lazy(() => import("@/pages/CandidateProfile").then((m) => ({ default: m.CandidateProfile })));
const RankingBoard = lazy(() => import("@/pages/RankingBoard").then((m) => ({ default: m.RankingBoard })));
const MatchDetail = lazy(() => import("@/pages/MatchDetail").then((m) => ({ default: m.MatchDetail })));
const Architecture = lazy(() => import("@/pages/Architecture").then((m) => ({ default: m.Architecture })));
const ErrorSandbox = lazy(() => import("@/pages/ErrorSandbox").then((m) => ({ default: m.ErrorSandbox })));
const NotFound = lazy(() => import("@/pages/NotFound").then((m) => ({ default: m.NotFound })));

function LazyFallback(): JSX.Element {
  return (
    <div className="px-6 py-12 max-w-6xl mx-auto space-y-8">
      <HudSkeleton lines={2} className="max-w-lg" />
      <div className="grid md:grid-cols-3 gap-4">
        <HudSkeleton lines={5} style={{ height: 180 }} />
        <HudSkeleton lines={5} style={{ height: 180 }} />
        <HudSkeleton lines={5} style={{ height: 180 }} />
      </div>
    </div>
  );
}

export default function App(): JSX.Element {
  return (
    <ErrorBoundary>
      <AppShell>
        <Suspense fallback={<LazyFallback />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/jobs" element={<JobsList />} />
            <Route path="/jobs/:id" element={<JobDetail />} />
            <Route path="/jobs/:id/upload" element={<UploadResumes />} />
            <Route path="/candidates" element={<CandidatesList />} />
            <Route path="/candidates/:id" element={<CandidateProfile />} />
            <Route path="/jobs/:id/ranking" element={<RankingBoard />} />
            <Route path="/jobs/:id/match/:candidateId" element={<MatchDetail />} />
            <Route path="/architecture" element={<Architecture />} />
            <Route path="/sandbox/errors" element={<ErrorSandbox />} />
            <Route path="/404" element={<NotFound />} />
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Routes>
        </Suspense>
      </AppShell>
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          classNames: {
            toast: "rounded-xl !border",
          },
        }}
      />
    </ErrorBoundary>
  );
}
