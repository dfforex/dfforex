import { json } from '../../lib/http.js';
import { getConfig, executionIsHardBlocked } from '../../lib/config.js';

export async function handler() {
  const cfg = getConfig();
  const hard = executionIsHardBlocked(cfg);
  return json(200, {
    supabase: {
      url_configured: Boolean(cfg.supabase.url),
      service_role_configured: Boolean(cfg.supabase.serviceRoleKey)
    },
    deriv: {
      app_id_configured: Boolean(cfg.deriv.appId),
      demo_token_configured: Boolean(cfg.deriv.tokenDemo),
      live_token_configured: Boolean(cfg.deriv.tokenLive),
      trade_mode: cfg.deriv.tradeMode
    },
    safety: {
      bot_mode: cfg.botMode,
      account_type: cfg.accountType,
      enable_order_execution: cfg.enableExecution,
      allow_live_trading: cfg.allowLiveTrading,
      execution_blocked: hard.blocked,
      block_reasons: hard.reasons
    },
    symbols: cfg.symbols,
    timeframe_minutes: cfg.timeframeMinutes
  });
}
