import { json } from '../../lib/http.js';
import { getSupabaseAdmin, insertLog } from '../../lib/supabaseAdmin.js';

function checkBridgeToken(event) {
  const expected = process.env.MT5_BRIDGE_TOKEN || '';
  if (!expected) return { ok: false, reason: 'MT5_BRIDGE_TOKEN não configurado no Netlify' };
  const got = (event.headers?.authorization || '').replace(/^Bearer\s+/i, '') || '';
  return got === expected ? { ok: true } : { ok: false, reason: 'Token do bridge inválido' };
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Use POST' });
  const auth = checkBridgeToken(event);
  if (!auth.ok) return json(401, { ok: false, error: auth.reason });
  const payload = JSON.parse(event.body || '{}');
  await insertLog('mt5_report', 'MT5 Bridge report', payload);
  const supabase = getSupabaseAdmin();
  if (supabase && payload?.ticket) {
    await supabase.from('trade_orders').insert({
      symbol: payload.symbol || payload.par || 'MT5',
      direction: String(payload.type || payload.direction || '').toLowerCase().includes('sell') ? 'sell' : 'buy',
      status: ['dry_run','pending','open','closed','cancelled','blocked','error','backtest'].includes(payload.status) ? payload.status : 'closed',
      profit: Number(payload.profit || 0),
      close_reason: payload.reason || 'MT5 Bridge',
      broker_order_id: String(payload.ticket || ''),
      payload
    }).then(() => null).catch(() => null);
  }
  return json(200, { ok: true, saved: true });
}
