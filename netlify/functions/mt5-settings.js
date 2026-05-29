import { json, options, safeJsonParse } from '../../lib/http.js';
import { getConfig } from '../../lib/config.js';
import { requireSupabase } from '../../lib/mt5Bridge.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return options();
  const cfg = getConfig();
  const supabase = requireSupabase();

  if (event.httpMethod === 'GET') {
    const { data, error } = await supabase.from('mt5_bridge_settings').select('*').eq('bridge_id', cfg.mt5.bridgeId).maybeSingle();
    if (error) return json(500, { ok: false, error: error.message });
    return json(200, { ok: true, settings: data || null, env: { bridge_id: cfg.mt5.bridgeId, server: cfg.mt5.server, login: cfg.mt5.login, account_type: cfg.accountType } });
  }

  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Use GET ou POST' });

  const body = safeJsonParse(event.body, {});
  const safeSettings = {
    bridge_id: body.bridge_id || cfg.mt5.bridgeId,
    broker_name: body.broker_name || 'Deriv MT5',
    account_login: body.account_login || null,
    account_server: body.account_server || 'Deriv-Demo',
    account_type: body.account_type || 'demo',
    symbols: body.symbols || cfg.symbols,
    risk_per_trade_pct: Number(body.risk_per_trade_pct || cfg.risk.maxRiskPerTradePct),
    fixed_lot: Number(body.fixed_lot || 0.01),
    scan_interval_seconds: Number(body.scan_interval_seconds || 60),
    updated_by: 'dashboard',
    // Nunca salvar senha aqui.
    secret_note: 'Senha MT5 deve ficar apenas no terminal MetaTrader 5 ou VPS local.'
  };

  const { data, error } = await supabase.from('mt5_bridge_settings').upsert(safeSettings, { onConflict: 'bridge_id' }).select('*').single();
  if (error) return json(500, { ok: false, error: error.message });
  return json(200, { ok: true, settings: data });
}
