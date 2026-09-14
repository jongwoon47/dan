import type { ConditionPreference, DemandType } from "@/domain/types";

const DRAFT_KEY = "dan-create-draft-v1";

export type CreateDraft = {
  type: DemandType | null;
  title: string;
  productQuery: string;
  productId: string;
  maxPrice: string;
  budget: string;
  condition: ConditionPreference;
  itemName: string;
  detail: string;
  buyShipping: boolean;
  buyMeetup: boolean;
  meetupPlace: string;
  borrowPlace: string;
  borrowStart: string;
  borrowEnd: string;
  taskMode: "onsite" | "pickup" | "route" | "remote";
  taskPlace: string;
  routeFrom: string;
  routeTo: string;
  dueAt: string;
  serviceMode: "onsite" | "remote";
  servicePlace: string;
  preferredAt: string;
};

export function saveCreateDraft(draft: CreateDraft): void {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* ignore quota */
  }
}

export function loadCreateDraft(): CreateDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CreateDraft;
  } catch {
    return null;
  }
}

export function clearCreateDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

/** Only allow same-origin relative paths for post-login return. */
export function safeReturnPath(raw: string | null | undefined, fallback = "/my"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return fallback;
  return raw;
}
