import { useMemo, useSyncExternalStore } from "react";

const STORAGE_KEY = "dan-saved-areas-v1";
const CHANGE_EVENT = "dan-saved-areas-change";
const MAX_SAVED = 3;

export type SavedArea = {
  label: string;
  country: "KR" | "JP";
};

/** Public neighborhood/city labels only; never precise addresses or device coordinates. */
function sanitizeArea(area: unknown): SavedArea | null {
  if (!area || typeof area !== "object") return null;
  const a = area as Partial<SavedArea>;
  if (a.country !== "KR" && a.country !== "JP") return null;
  const label = typeof a.label === "string" ? a.label.trim().replace(/\s+/g, " ") : "";
  if (label.length < 2 || label.length > 60) return null;
  // Public search areas only. Reject postal codes, house/room numbers,
  // coordinates and URLs rather than persisting a likely residential address.
  if (/https?:|〒|(?:\\d{3}-?\\d{4})|(?:\\d{2,}[-–]\\d+)|(?:\\d+\\.\\d+)|(?:번지|호실|号室)/iu.test(label)) return null;
  return { label, country: a.country };
}

function snapshot(): string {
  try { return localStorage.getItem(STORAGE_KEY) ?? "[]"; }
  catch { return "[]"; }
}

function serverSnapshot() { return "[]"; }

function subscribe(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

export function parseSavedAreas(raw: string): SavedArea[] {
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    const out: SavedArea[] = [];
    const seen = new Set<string>();
    for (const value of data) {
      const area = sanitizeArea(value);
      if (!area) continue;
      const key = `${area.country}:${area.label.normalize("NFKC").toLocaleLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(area);
      if (out.length >= MAX_SAVED) break;
    }
    return out;
  } catch { return []; }
}

export function useSavedAreas(): SavedArea[] {
  const raw = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return useMemo(() => parseSavedAreas(raw), [raw]);
}

export function addSavedArea(input: SavedArea): "saved" | "exists" | "full" | "invalid" {
  const cleaned = sanitizeArea(input);
  if (!cleaned) return "invalid";
  const existing = parseSavedAreas(snapshot());
  if (existing.some((area) =>
    area.country === cleaned.country &&
    area.label.normalize("NFKC").toLocaleLowerCase() ===
    cleaned.label.normalize("NFKC").toLocaleLowerCase()
  )) return "exists";
  if (existing.length >= MAX_SAVED) return "full";
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, cleaned]));
    window.dispatchEvent(new Event(CHANGE_EVENT));
    return "saved";
  } catch { return "invalid"; }
}

export function removeSavedArea(area: SavedArea): void {
  try {
    const next = parseSavedAreas(snapshot()).filter(
      (entry) => !(entry.country === area.country && entry.label === area.label),
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch { /* ignore */ }
}
