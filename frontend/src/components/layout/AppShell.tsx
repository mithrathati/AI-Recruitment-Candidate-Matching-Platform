import { NavLink, Link, useLocation } from "react-router-dom";
import { useEffect, useState, type PropsWithChildren, type ReactNode } from "react";
import { toast } from "sonner";
import { AppProvider, useActiveJob } from "@/context/AppContext";
import { cn } from "@/lib/utils";
import { HudBadge } from "@/components/ui/HudBadge";
import { api, ApiError } from "@/lib/api/client";
import type { InfoResponse } from "@/lib/api/types";

const NAV = [
  { to: "/", label: "Dashboard", icon: "⌂" },
  { to: "/jobs", label: "Jobs", icon: "▤" },
  { to: "/candidates", label: "Candidates", icon: "◉" },
  { to: "/architecture", label: "Architecture", icon: "⚙" },
  { to: "/sandbox/errors", label: "Errors", icon: "⚠" },
] as const;

function AppShellInner({ children }: PropsWithChildren): JSX.Element {
  const { activeJob, activeJobId, setActiveJob } = useActiveJob();
  const loc = useLocation();
  const [embeddingBackend, setEmbeddingBackend] = useState<string | null>(null);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async (): Promise<void> => {
      try {
        const [info, health] = await Promise.all([api.getInfo(), api.getHealth()]);
        if (cancelled) return;
        setEmbeddingBackend(info.embedding_backend);
        setBackendOnline(health.status === "ok");
      } catch (e) {
        if (cancelled) return;
        setBackendOnline(false);
        if (e instanceof ApiError && e.code === "CONNECTION_REFUSED") {
          // Don't spam toast — Dashboard shows a banner
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loc.pathname]);

  // If there's an activeJobId and no job loaded, try to load it.
  useEffect(() => {
    if (!activeJobId || activeJob) return;
    let cancelled = false;
    api
      .getJob(activeJobId)
      .then((j) => {
        if (!cancelled) setActiveJob(j);
      })
      .catch(() => {
        /* id could be wrong — silently ignore */
      });
    return () => {
      cancelled = true;
    };
  }, [activeJobId, activeJob, setActiveJob]);

  return (
    <div className="relative min-h-screen">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-c-bg-deep/70 border-b border-c-border-soft">
        <div className="max-w-[1400px] mx-auto px-5 md:px-8 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="group flex items-center gap-3 shrink-0">
            <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-c-cyan/60 bg-gradient-to-br from-c-cyan/15 via-c-violet/20 to-c-magenta/15 shadow-neon-cyan">
              <span className="text-c-cyan font-black tracking-tighter">AI</span>
            </span>
            <div className="leading-tight">
              <div className="text-base md:text-[0.95rem] font-extrabold tracking-wider neon-text">
                RECRUITMENT PLATFORM
              </div>
              <div className="hud-label mt-0.5">DSTARIX · GENAI INTERNSHIP</div>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "px-3 py-2 rounded-lg text-sm font-medium transition-colors relative",
                    isActive
                      ? "text-c-cyan bg-c-cyan/10 shadow-inner border border-c-cyan/30"
                      : "text-c-text-dim hover:text-c-text-main hover:bg-white/5",
                  )
                }
              >
                <span className="mr-1.5 text-c-violet">{n.icon}</span>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {backendOnline !== null && (
              <HudBadge tone={backendOnline ? "match" : "missing"} dot={true} className="hidden sm:inline-flex">
                {backendOnline ? `Backend Online · ${embeddingBackend ?? ""}` : "Backend Offline"}
              </HudBadge>
            )}
            {activeJob && (
              <HudBadge tone="violet" className="hidden lg:inline-flex max-w-[220px] truncate">
                Job: {activeJob.title}
              </HudBadge>
            )}
          </div>
        </div>
      </header>

      <main className="relative max-w-[1400px] mx-auto px-4 md:px-8 py-8">{children}</main>

      <footer className="mt-16 border-t border-c-border-soft">
        <div className="max-w-[1400px] mx-auto px-6 md:px-8 py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="text-sm font-bold neon-text">AI Recruitment Platform</div>
            <div className="text-xs text-c-text-dim mt-1">
              Powered by FastAPI · Embeddings · LLMs · Semantic Matching
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <FooterLink href="http://127.0.0.1:8000/docs" label="Backend Swagger UI" />
            <FooterLink href="http://127.0.0.1:8000/redoc" label="Redoc API" />
            <FooterLink href="/architecture" label="Architecture Page" />
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterLink({ href, label }: { href: string; label: string }): JSX.Element {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noreferrer" : undefined}
      className="hud-chip hud-chip--neutral !py-1 hover:border-c-cyan/60 hover:text-c-cyan transition-colors"
    >
      {label}
    </a>
  );
}

export function AppShell({ children }: PropsWithChildren): JSX.Element {
  return (
    <AppProvider>
      <InfoPrimer />
      <AppShellInner>{children}</AppShellInner>
    </AppProvider>
  );
}

function InfoPrimer(): null {
  // Priming cache for toast messages on first error
  useEffect(() => {
    (window as unknown as { __recruitmentToast?: unknown }).__recruitmentToast = toast;
  }, []);
  return null;
}

export function withInfoResponse(): Promise<InfoResponse> | null {
  return null;
}

export type { InfoResponse as IR };
export type ReactNodeType = ReactNode;
