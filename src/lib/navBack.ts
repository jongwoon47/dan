import type { NavigateFunction } from "react-router-dom";

/**
 * Prefer in-app history when React Router has an entry (state.idx > 0).
 * External / cold entry falls back to a safe root route instead of
 * `history.length`-based back (which can leave the app).
 */
export function navigateBack(
  navigate: NavigateFunction,
  fallbackTo: string,
): void {
  const idx = (window.history.state as { idx?: number } | null)?.idx;
  if (typeof idx === "number" && idx > 0) {
    navigate(-1);
    return;
  }
  navigate(fallbackTo, { replace: true });
}
