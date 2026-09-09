import { useEffect, type PropsWithChildren } from "react";
import { HudCard } from "@/components/ui/HudCard";
import { NeonButton } from "@/components/ui/NeonButton";

export interface ConfirmModalProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  loading,
  onClose,
  onConfirm,
}: ConfirmModalProps): JSX.Element | null {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg">
        <HudCard glow={danger ? "magenta" : "cyan"} cornerBrackets className="p-6">
          <p className="hud-label">CONFIRMATION</p>
          <h3 className="text-xl font-bold mt-1 neon-text--cyan">{title}</h3>
          {description && <p className="mt-3 text-sm text-c-text-dim leading-relaxed">{description}</p>}
          <div className="mt-6 flex items-center justify-end gap-3">
            <NeonButton variant="ghost" onClick={onClose} disabled={loading}>
              {cancelLabel}
            </NeonButton>
            <NeonButton
              variant={danger ? "danger" : "primary"}
              loading={loading}
              onClick={onConfirm}
            >
              {confirmLabel}
            </NeonButton>
          </div>
        </HudCard>
      </div>
    </div>
  );
}

export function ModalShell({
  open,
  onClose,
  children,
  widthClass = "max-w-2xl",
  title,
}: PropsWithChildren<{
  open: boolean;
  onClose: () => void;
  widthClass?: string;
  title?: string;
}>): JSX.Element | null {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start md:items-center justify-center p-4 bg-black/70 backdrop-blur-md overflow-auto"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className={`w-full ${widthClass} my-6`}>
        <HudCard cornerBrackets className="p-6">
          {title && (
            <>
              <p className="hud-label">HUD MODAL</p>
              <h3 className="text-xl font-bold mt-1 neon-text">{title}</h3>
              <div className="hud-divider my-4" />
            </>
          )}
          {children}
        </HudCard>
      </div>
    </div>
  );
}
