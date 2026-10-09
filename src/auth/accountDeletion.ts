import { getSupabase } from '@/data/supabase/client';
import { getSupabaseEnv } from '@/data/mode';

export type DeletionStatus = { activeTransactions: number; pending: boolean };
export async function accountDeletionStatus(): Promise<DeletionStatus> {
  const { data, error } = await getSupabase().rpc('account_deletion_status');
  if (error) throw new Error('삭제 가능 여부를 확인하지 못했어요. 다시 시도해 주세요.');
  return data as DeletionStatus;
}

export async function deleteAccount(): Promise<void> {
  const { url, anonKey } = getSupabaseEnv();
  const { data } = await getSupabase().auth.getSession();
  if (!data.session) throw new Error('다시 로그인해 주세요.');
  const response = await fetch(`${url}/functions/v1/delete-account`, { method: 'POST',
    headers: { Authorization: `Bearer ${data.session.access_token}`, apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirm: true }) });
  const result = await response.json() as { code?: string };
  if (!response.ok || result.code !== 'DELETED') {
    if (result.code === 'ACTIVE_TRANSACTIONS') throw new Error('진행 중 거래 또는 분쟁을 먼저 완료하거나 취소해 주세요.');
    throw new Error('삭제를 완료하지 못했어요. 다시 시도해 주세요. 삭제가 시작된 계정은 거래 기능을 이용할 수 없어요.');
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
