import { json, options, nowIso } from '../../lib/http.js';
import { getConfig } from '../../lib/config.js';
import { requireSupabase, verifyBridgeSecret, normalizeBridgeId } from '../../lib/mt5Bridge.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return options();
  if (event.httpMethod !== 'GET') return json(405, { ok: false, error: 'Use GET' });

  const cfg = getConfig();
  const check = verifyBridgeSecret(event, cfg);
  if (!check.ok) return json(401, { ok: false, error: check.error });

  const bridgeId = normalizeBridgeId(event, {});
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('mt5_commands')
    .select('*')
    .eq('bridge_id', bridgeId)
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(1);
  if (error) return json(500, { ok: false, error: error.message });

  const command = data?.[0] || null;
  if (command) {
    await supabase.from('mt5_commands').update({ status: 'sent', sent_at: nowIso() }).eq('id', command.id);
  }

  return json(200, {
    ok: true,
    bridge_id: bridgeId,
    server_time: nowIso(),
    config: {
      bot_mode: cfg.botMode,
      account_type: cfg.accountType,
      enable_execution: cfg.enableExecution,
      allow_live_trading: cfg.allowLiveTrading,
      max_risk_per_trade_pct: cfg.risk.maxRiskPerTradePct,
      min_signal_score: cfg.risk.minSignalScore,
      symbols: cfg.symbols
    },
    command
  });
}
