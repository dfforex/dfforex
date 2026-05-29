import { json, options } from '../../lib/http.js';
import { getConfig, executionIsHardBlocked } from '../../lib/config.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return options();
  const cfg = getConfig();
  const hard = executionIsHardBlocked(cfg);
  return json(200, {
    ok: true,
    version: cfg.appVersion,
    broker_connector: cfg.brokerConnector,
    mt5: {
      bridge_id: cfg.mt5.bridgeId,
      server: cfg.mt5.server,
      login_configured: Boolean(cfg.mt5.login),
      secret_configured: Boolean(cfg.mt5.bridgeSecret),
      allow_real_trading: cfg.mt5.allowRealTrading
    },
    supabase_configured: Boolean(cfg.supabase.url && cfg.supabase.serviceRoleKey),
    execution: {
      bot_mode: cfg.botMode,
      account_type: cfg.accountType,
      enable_execution: cfg.enableExecution,
      allow_live_trading: cfg.allowLiveTrading,
      blocked: hard.blocked,
      reasons: hard.reasons
    }
  });
}
