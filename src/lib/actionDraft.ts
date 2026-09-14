import type { ItemCondition } from "@/domain/types";

const OWN_KEY = "dan-own-draft-v1";
const RESPONSE_KEY = "dan-response-draft-v1";
/** Auth-return drafts should not resurrect days later. */
const DRAFT_TTL_MS = 2 * 60 * 60 * 1000;

export type OwnDraft = {
  productId: string;
  condition: ItemCondition;
  savedAt: number;
};

export type ResponseDraft = {
  demandId: string;
  offerPrice: string;
  availability: string;
  message: string;
  savedAt: number;
};

function readJson<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota */
  }
}

function removeKey(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function isFresh(savedAt: unknown): boolean {
  return (
    typeof savedAt === "number" &&
    Number.isFinite(savedAt) &&
    Date.now() - savedAt <= DRAFT_TTL_MS
  );
}

export function saveOwnDraft(draft: Omit<OwnDraft, "savedAt">): void {
  writeJson(OWN_KEY, { ...draft, savedAt: Date.now() });
}

export function loadOwnDraft(productId: string): ItemCondition | null {
  const draft = readJson<OwnDraft>(OWN_KEY);
  if (!draft) return null;
  if (!isFresh(draft.savedAt) || draft.productId !== productId) {
    removeKey(OWN_KEY);
    return null;
  }
  if (
    draft.condition !== "sealed" &&
    draft.condition !== "like_new" &&
    draft.condition !== "lightly_used"
  ) {
    removeKey(OWN_KEY);
    return null;
  }
  return draft.condition;
}

export function clearOwnDraft(): void {
  removeKey(OWN_KEY);
}

export function saveResponseDraft(draft: Omit<ResponseDraft, "savedAt">): void {
  writeJson(RESPONSE_KEY, { ...draft, savedAt: Date.now() });
}

export function loadResponseDraft(demandId: string): Omit<ResponseDraft, "savedAt"> | null {
  const draft = readJson<ResponseDraft>(RESPONSE_KEY);
  if (!draft) return null;
  if (!isFresh(draft.savedAt) || draft.demandId !== demandId) {
    removeKey(RESPONSE_KEY);
    return null;
  }
  const { savedAt: _ignored, ...rest } = draft;
  return rest;
}

export function clearResponseDraft(): void {
  removeKey(RESPONSE_KEY);
}
