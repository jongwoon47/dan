import { beforeEach, expect, it, vi } from 'vitest';
import { accountDeletionStatus, clearDeletedAccountStorage, deleteAccount } from './accountDeletion';
const { rpc, getSession } = vi.hoisted(() => ({ rpc: vi.fn(), getSession: vi.fn() }));
vi.mock('@/data/supabase/client', () => ({ getSupabase: () => ({ rpc, auth: { getSession } }) }));
vi.mock('@/data/mode', () => ({ getSupabaseEnv: () => ({ url: 'https://stage.supabase.co', anonKey: 'public-key' }) }));
beforeEach(() => { vi.resetAllMocks(); localStorage.clear(); sessionStorage.clear(); vi.unstubAllGlobals(); });
it('loads blockers from the authenticated server, without sending a user ID', async () => {
  rpc.mockResolvedValue({ data: { activeTransactions: 1, pending: false }, error: null });
  expect(await accountDeletionStatus()).toEqual({ activeTransactions: 1, pending: false });
  expect(rpc).toHaveBeenCalledWith('account_deletion_status');
});
it('requires a session and never submits an arbitrary user ID', async () => {
  getSession.mockResolvedValue({ data: { session: null } });
  await expect(deleteAccount()).rejects.toThrow("DAN_DELETE_RELOGIN");
  getSession.mockResolvedValue({ data: { session: { access_token: "test-token" } } });
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ code: "DELETED" }) });
  vi.stubGlobal("fetch", fetcher);
  await deleteAccount();
  expect(JSON.parse(fetcher.mock.calls[0]![1].body)).toEqual({ confirm: true });
});
it("handles active transactions and retry errors without reporting success", async () => {
  getSession.mockResolvedValue({ data: { session: { access_token: "test-token" } } });
  const fetcher = vi.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ code: "ACTIVE_TRANSACTIONS" }),
  });
  vi.stubGlobal("fetch", fetcher);
  await expect(deleteAccount()).rejects.toThrow("DAN_DELETE_ACTIVE");
  fetcher.mockResolvedValue({
    ok: false,
    json: async () => ({ code: "DELETE_RETRY_REQUIRED" }),
  });
  await expect(deleteAccount()).rejects.toThrow("DAN_DELETE_FAIL_PENDING");
});
it('clears DAN drafts and its Supabase session but preserves unrelated keys', () => {
  localStorage.setItem('dan-v1-store', 'private'); sessionStorage.setItem('dan-create-draft', 'private');
  localStorage.setItem('sb-stage-auth-token', 'session'); localStorage.setItem('sb-other-auth-token', 'other');
  localStorage.setItem('theme', 'light'); clearDeletedAccountStorage();
  expect(localStorage.getItem('dan-v1-store')).toBeNull(); expect(sessionStorage.length).toBe(0);
  expect(localStorage.getItem('sb-stage-auth-token')).toBeNull();
  expect(localStorage.getItem('sb-other-auth-token')).toBe('other'); expect(localStorage.getItem('theme')).toBe('light');
});
