import { json, options } from '../../lib/http.js';
import { getConfig } from '../../lib/config.js';
import { requireSupabase } from '../../lib/mt5Bridge.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return options();
  try {
    const cfg = getConfig();
    const bridgeId = event.queryStringParameters?.bridge_id || cfg.mt5.bridgeId;
    const supabase = requireSupabase();
    const { data, error } = await supabase.from('mt5_bridge_status').select('*').eq('bridge_id', bridgeId).maybeSingle();
    if (error) return json(500, { ok: false, error: error.message });
    const ageSec = data?.last_seen_at ? Math.round((Date.now() - new Date(data.last_seen_at).getTime()) / 1000) : null;
    return json(200, { ok: true, bridge_id: bridgeId, connected: Boolean(data && ageSec !== null && ageSec <= cfg.mt5.heartbeatMaxAgeSeconds), age_seconds: ageSec, status: data || null });
  } catch (err) {
    return json(500, { ok: false, error: err.message });
  }
}
