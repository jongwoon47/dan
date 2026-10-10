import { getSupabase } from '@/data/supabase/client';
import { getSupabaseEnv } from '@/data/mode';

export type DeletionStatus = { activeTransactions: number; pending: boolean };
export async function accountDeletionStatus(): Promise<DeletionStatus> {
  const { data, error } = await getSupabase().rpc('account_deletion_status');
  if (error) throw new Error("DAN_DELETE_STATUS_FAIL");
  return data as DeletionStatus;
}

export async function deleteAccount(): Promise<void> {
  const { url, anonKey } = getSupabaseEnv();
  const { data } = await getSupabase().auth.getSession();
  if (!data.session) throw new Error("DAN_DELETE_RELOGIN");
  const response = await fetch(`${url}/functions/v1/delete-account`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ confirm: true }),
  });
  const result = (await response.json()) as { code?: string };
  if (!response.ok || result.code !== "DELETED") {
    if (result.code === "ACTIVE_TRANSACTIONS") {
      throw new Error("DAN_DELETE_ACTIVE");
    }
    throw new Error("DAN_DELETE_FAIL_PENDING");
  }
}

/** DAN-owned drafts/cache and this project's Auth session only. */
export function clearDeletedAccountStorage() {
  const projectRef = new URL(getSupabaseEnv().url).hostname.split('.')[0];
  for (const storage of [localStorage, sessionStorage]) {
    for (const key of Object.keys(storage)) {
      if (/^dan[-_:]/i.test(key) || key.startsWith(`sb-${projectRef}-auth-token`)) storage.removeItem(key);
    }
  }
}
