import type { PropsWithChildren } from "react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { HudCard } from "@/components/ui/HudCard";
import { NeonButton } from "@/components/ui/NeonButton";

interface Props extends PropsWithChildren {
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info);
  }

  private reset = (): void => this.setState({ error: null });

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-6">
        <HudCard cornerBrackets className="max-w-xl w-full p-8">
          <p className="hud-label">SYSTEM FAULT</p>
          <h2 className="text-2xl font-bold mt-2 neon-text--magenta">
            Render Error · Signal Lost
          </h2>
          <p className="mt-3 text-c-text-dim">
            A UI rendering fault has been caught and contained. Details:{" "}
            <code className="px-2 py-0.5 rounded bg-black/40 text-c-red/90">
              {this.state.error.message}
            </code>
          </p>
          <div className="mt-6 flex gap-3">
            <NeonButton variant="primary" onClick={this.reset}>
              Reset View
            </NeonButton>
            <NeonButton variant="ghost" onClick={() => window.location.reload()}>
              Reload Page
            </NeonButton>
          </div>
        </HudCard>
      </div>
    );
  }
}
