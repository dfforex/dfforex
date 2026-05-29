import { json, options } from '../../lib/http.js';
import { getConfig, executionIsHardBlocked } from '../../lib/config.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return options();
  const cfg = getConfig();
  const hard = executionIsHardBlocked(cfg);
  return json(200, {
    ok: true,
    app: 'DF Forex Pro',
    version: cfg.appVersion,
    broker: cfg.brokerConnector,
    mode: cfg.botMode,
    account_type: cfg.accountType,
    execution_blocked: hard.blocked,
    block_reasons: hard.reasons,
    supabase_configured: Boolean(cfg.supabase.url && cfg.supabase.serviceRoleKey),
    mt5_bridge_id: cfg.mt5.bridgeId,
    mt5_server: cfg.mt5.server
  });
}
