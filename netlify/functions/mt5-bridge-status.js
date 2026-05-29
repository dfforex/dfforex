import { json } from '../../lib/http.js';
import { getSupabaseAdmin } from '../../lib/supabaseAdmin.js';

export async function handler(event) {
  const params = event.queryStringParameters || {};
  const login = params.login || '';
  const server = params.server || '';
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return json(200, { ok: true, connected: false, reason: 'Supabase não configurado', login, server });
  }
  const { data, error } = await supabase
    .from('bot_runtime_logs')
    .select('created_at, payload')
    .eq('level', 'mt5_heartbeat')
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) return json(200, { ok: false, connected: false, error: error.message, login, server });
  const last = data?.[0];
  const ageSec = last ? Math.round((Date.now() - new Date(last.created_at).getTime()) / 1000) : null;
  return json(200, {
    ok: true,
    connected: Boolean(last && ageSec !== null && ageSec <= 120),
    last_heartbeat: last?.created_at || null,
    age_seconds: ageSec,
    login,
    server,
    payload: last?.payload || null
  });
}
