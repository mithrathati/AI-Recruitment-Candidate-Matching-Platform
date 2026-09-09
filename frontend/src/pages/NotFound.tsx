import { Link } from "react-router-dom";
import { HudCard } from "@/components/ui/HudCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { ScanOverlay } from "@/components/ui/ScanOverlay";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export function NotFound(): JSX.Element {
  useDocumentTitle("404 · Signal Lost");
  return (
    <div className="min-h-[70vh] flex items-center justify-center relative">
      <ScanOverlay />
      <HudCard cornerBrackets className="max-w-xl w-full p-10 text-center relative overflow-hidden">
        <div className="text-[6rem] font-black leading-none neon-text tracking-tighter">404</div>
        <p className="hud-label mt-2">NAVIGATION FAULT</p>
        <h2 className="text-xl font-bold mt-3 text-c-text-main">Signal Lost — Coordinates Unknown</h2>
        <p className="mt-3 text-c-text-dim">
          The page you requested does not exist or was moved outside the recruitment network.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link to="/">
            <NeonButton variant="primary" size="lg">Return to Dashboard</NeonButton>
          </Link>
          <Link to="/jobs">
            <NeonButton variant="ghost" size="lg">View Jobs</NeonButton>
          </Link>
        </div>
      </HudCard>
    </div>
  );
}
