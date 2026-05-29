import { json, options, safeJsonParse, nowIso } from '../../lib/http.js';
import { getConfig } from '../../lib/config.js';
import { requireSupabase, verifyBridgeSecret, normalizeBridgeId } from '../../lib/mt5Bridge.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return options();
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Use POST' });

  const cfg = getConfig();
  const check = verifyBridgeSecret(event, cfg);
  if (!check.ok) return json(401, { ok: false, error: check.error });

  const body = safeJsonParse(event.body, {});
  const bridgeId = normalizeBridgeId(event, body);
  const supabase = requireSupabase();
  const now = nowIso();

  const statusPayload = {
    bridge_id: bridgeId,
    status: body.status || 'online',
    bot_running: Boolean(body.bot_running),
    account_login: body.account_login || null,
    account_name: body.account_name || null,
    account_server: body.account_server || cfg.mt5.server,
    account_type: body.account_type || cfg.accountType,
    balance: body.balance ?? null,
    equity: body.equity ?? null,
    margin: body.margin ?? null,
    free_margin: body.free_margin ?? null,
    open_positions: body.open_positions ?? null,
    terminal_connected: body.terminal_connected ?? null,
    trade_allowed: body.trade_allowed ?? null,
    last_error: body.last_error || null,
    last_seen_at: now,
    payload: body
  };

  const { error: statusError } = await supabase.from('mt5_bridge_status').upsert(statusPayload, { onConflict: 'bridge_id' });
  if (statusError) return json(500, { ok: false, error: statusError.message });

  if (body.event || body.message) {
    await supabase.from('bot_runtime_logs').insert({
      level: body.level || 'info',
      message: body.message || body.event,
      payload: body,
      bridge_id: bridgeId
    });
  }

  if (Array.isArray(body.signals)) {
    for (const sig of body.signals) {
      await supabase.from('strategy_signals').insert({
        symbol: sig.symbol,
        timeframe: sig.timeframe || 'MT5',
        strategy_name: sig.strategy_name || sig.strategy || 'DF Trend Pullback Core',
        direction: sig.direction,
        entry_price: sig.entry_price ?? null,
        stop_loss: sig.stop_loss ?? null,
        take_profit: sig.take_profit ?? null,
        risk_reward: sig.risk_reward ?? null,
        score: sig.score ?? null,
        market_regime: sig.market_regime || null,
        spread_points: sig.spread_points ?? null,
        atr_value: sig.atr_value ?? null,
        approved: Boolean(sig.approved),
        rejection_reason: sig.rejection_reason || null,
        payload: sig
      });
    }
  }

  if (Array.isArray(body.orders)) {
    for (const order of body.orders) {
      await supabase.from('trade_orders').upsert({
        mt5_ticket: String(order.ticket || order.mt5_ticket || ''),
        symbol: order.symbol,
        strategy_name: order.strategy_name || 'DF Trend Pullback Core',
        direction: order.direction,
        lot_size: order.lot_size ?? order.volume ?? null,
        entry_price: order.entry_price ?? null,
        stop_loss: order.stop_loss ?? null,
        take_profit: order.take_profit ?? null,
        status: order.status || 'open',
        profit: order.profit ?? null,
        profit_r: order.profit_r ?? null,
        spread_at_entry: order.spread_at_entry ?? null,
        slippage: order.slippage ?? null,
        closed_at: order.closed_at || null,
        close_reason: order.close_reason || null,
        payload: order
      }, { onConflict: 'mt5_ticket' });
    }
  }

  if (body.command_ack?.id) {
    await supabase.from('mt5_commands').update({
      status: body.command_ack.status || 'done',
      response: body.command_ack,
      processed_at: now
    }).eq('id', body.command_ack.id);
  }

  return json(200, { ok: true, bridge_id: bridgeId, received_at: now });
}
