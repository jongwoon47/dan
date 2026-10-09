import { createClient } from 'npm:@supabase/supabase-js@2.116.0';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const reply = (status: number, code: string) => new Response(JSON.stringify({ code }), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return reply(405, 'METHOD_NOT_ALLOWED');
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return reply(401, 'UNAUTHORIZED');
  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const body = await request.json();
    // There is deliberately no caller-supplied user ID, including ignored IDs.
    if (!body || body.confirm !== true || Object.keys(body).some(k => k !== 'confirm')) return reply(400, 'CONFIRMATION_REQUIRED');
    const { data: { user }, error: authError } = await caller.auth.getUser(authorization.slice(7));
    if (authError || !user) return reply(401, 'UNAUTHORIZED');
    const { error: reserveError } = await caller.rpc('begin_account_deletion', { p_confirm: true });
    if (reserveError) return reply(reserveError.message.includes('ACTIVE_TRANSACTIONS') ? 409 : 403,
      reserveError.message.includes('ACTIVE_TRANSACTIONS') ? 'ACTIVE_TRANSACTIONS' : 'UNAUTHORIZED');
    const { data: files, error: filesError } = await admin.rpc('account_deletion_files', { p_user_id: user.id });
    if (filesError) return reply(503, 'DELETE_RETRY_REQUIRED');
    const byBucket = new Map<string, string[]>();
    for (const file of files as { bucket: string; name: string }[]) {
      byBucket.set(file.bucket, [...(byBucket.get(file.bucket) ?? []), file.name]);
    }
    for (const [bucket, names] of byBucket) {
      for (let i = 0; i < names.length; i += 100) {
        const { error } = await admin.storage.from(bucket).remove(names.slice(i, i + 100));
        if (error) return reply(503, 'DELETE_RETRY_REQUIRED');
      }
    }
    // GoTrue hard-deletes Auth identities/sessions; an atomic DB trigger redacts
    // DAN records and rechecks blockers/files before the Auth deletion commits.
    const { error: deletionError } = await admin.auth.admin.deleteUser(user.id, false);
    if (deletionError) return reply(503, 'DELETE_RETRY_REQUIRED');
    return reply(200, 'DELETED');
  } catch {
    // Never log requests, tokens, identities, provider secrets or database details.
    return reply(400, 'DELETE_RETRY_REQUIRED');
  }
});
