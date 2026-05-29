import { json } from '../../lib/http.js';
import { getConfig, executionIsHardBlocked } from '../../lib/config.js';

export async function handler() {
  const cfg = getConfig();
  const hard = executionIsHardBlocked(cfg);
  return json(200, {
    ok: true,
    app: 'DF Forex Pro',
    version: '2.0.0-netlify-node',
    node: process.version,
    broker: cfg.brokerConnector,
    mode: cfg.botMode,
    account_type: cfg.accountType,
    execution_blocked: hard.blocked,
    block_reasons: hard.reasons,
    supabase_configured: Boolean(cfg.supabase.url && cfg.supabase.serviceRoleKey),
    deriv_configured: Boolean(cfg.deriv.appId && (cfg.deriv.tokenDemo || cfg.deriv.tokenLive))
  });
}
