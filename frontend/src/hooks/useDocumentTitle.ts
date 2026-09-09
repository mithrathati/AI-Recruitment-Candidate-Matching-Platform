import { useEffect } from "react";

const APP_NAME = import.meta.env.VITE_APP_NAME ?? "AI Recruitment Platform";

export function useDocumentTitle(segment?: string): void {
  useEffect(() => {
    document.title = segment ? `${segment} · ${APP_NAME}` : APP_NAME;
  }, [segment]);
}
