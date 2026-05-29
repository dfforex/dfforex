import { json, safeError } from '../../lib/http.js';
import { getSupabaseAdmin, insertLog } from '../../lib/supabaseAdmin.js';
import { getRequestDerivToken, getRequestDerivAppId } from '../../lib/derivAuth.js';
import { syncDerivContract } from '../../lib/derivTrading.js';

export async function handler(event) {
  const tokenInfo = getRequestDerivToken(event);
  const derivAppId = getRequestDerivAppId(event);
  if (!tokenInfo.token) return json(401, { ok: false, error: 'Token Deriv ausente. Conecte a Deriv.' });
  const supabase = getSupabaseAdmin();
  if (!supabase) return json(400, { ok: false, error: 'Supabase não configurado no Netlify.' });

  try {
    const openOrders = await supabase
      .from('trade_orders')
      .select('*')
      .eq('broker', 'deriv_api')
      .eq('status', 'open')
      .not('broker_order_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(30);

    if (openOrders.error) throw new Error(openOrders.error.message);
    const updated = [];
    for (const order of openOrders.data || []) {
      const contractId = Number(order.broker_order_id);
      if (!contractId) continue;
      const status = await syncDerivContract({ token: tokenInfo.token, contractId });
      const closed = status.is_sold || status.is_expired || ['won', 'lost', 'sold'].includes(String(status.status).toLowerCase());
      const patch = {
        profit: Number(status.profit || 0),
        payload: { ...(order.payload || {}), last_sync: status }
      };
      if (closed) {
        patch.status = 'closed';
        patch.closed_at = new Date().toISOString();
        patch.close_reason = status.profit >= 0 ? 'win' : 'loss';
      }
      const res = await supabase.from('trade_orders').update(patch).eq('id', order.id).select('*').single();
      if (!res.error) updated.push(res.data);
    }

    await insertLog('info', 'deriv-sync-orders executado', { updated: updated.length });
    return json(200, { ok: true, updated_count: updated.length, orders: updated });
  } catch (err) {
    await insertLog('error', 'Erro em deriv-sync-orders', { error: safeError(err) });
    return json(500, { ok: false, error: safeError(err) });
  }
}
