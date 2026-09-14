import type { ItemCondition } from "@/domain/types";

const OWN_KEY = "dan-own-draft-v1";
const RESPONSE_KEY = "dan-response-draft-v1";

export type OwnDraft = {
  productId: string;
  condition: ItemCondition;
};

export type ResponseDraft = {
  demandId: string;
  offerPrice: string;
  availability: string;
  message: string;
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

export function saveOwnDraft(draft: OwnDraft): void {
  writeJson(OWN_KEY, draft);
}

export function loadOwnDraft(productId: string): ItemCondition | null {
  const draft = readJson<OwnDraft>(OWN_KEY);
  if (!draft || draft.productId !== productId) return null;
  if (
    draft.condition !== "sealed" &&
    draft.condition !== "like_new" &&
    draft.condition !== "lightly_used"
  ) {
    return null;
  }
  return draft.condition;
}

export function clearOwnDraft(): void {
  removeKey(OWN_KEY);
}

export function saveResponseDraft(draft: ResponseDraft): void {
  writeJson(RESPONSE_KEY, draft);
}

export function loadResponseDraft(demandId: string): ResponseDraft | null {
  const draft = readJson<ResponseDraft>(RESPONSE_KEY);
  if (!draft || draft.demandId !== demandId) return null;
  return draft;
}

export function clearResponseDraft(): void {
  removeKey(RESPONSE_KEY);
}
