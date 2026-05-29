import { parseBool, num } from './http.js';

export function getConfig() {
  const accountType = process.env.ACCOUNT_TYPE || 'demo';
  const botMode = process.env.BOT_MODE || 'dry_run';
  const enableExecution = parseBool(process.env.ENABLE_ORDER_EXECUTION, false);
  const allowLive = parseBool(process.env.ALLOW_LIVE_TRADING, false);

  return {
    botMode,
    accountType,
    brokerConnector: process.env.BROKER_CONNECTOR || 'deriv_api',
    enableExecution,
    allowLiveTrading: allowLive,
    deriv: {
      appId: process.env.DERIV_APP_ID || '1089',
      tokenDemo: process.env.DERIV_API_TOKEN_DEMO || '',
      tokenLive: process.env.DERIV_API_TOKEN_LIVE || '',
      tradeMode: process.env.DERIV_TRADE_MODE || 'data_only',
      enableOrderExecution: parseBool(process.env.DERIV_ENABLE_ORDER_EXECUTION, false)
    },
    supabase: {
      url: process.env.SUPABASE_URL || '',
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    },
    symbols: (process.env.FOREX_SYMBOLS || 'frxEURUSD,frxGBPUSD,frxUSDJPY,frxAUDUSD')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    timeframeMinutes: num(process.env.DEFAULT_TIMEFRAME_MINUTES, 60),
    risk: {
      maxRiskPerTradePct: num(process.env.MAX_RISK_PER_TRADE_PCT, 0.5),
      maxDailyLossPct: num(process.env.MAX_DAILY_LOSS_PCT, 2),
      maxWeeklyLossPct: num(process.env.MAX_WEEKLY_LOSS_PCT, 5),
      maxMonthlyDrawdownPct: num(process.env.MAX_MONTHLY_DRAWDOWN_PCT, 10),
      minSignalScore: num(process.env.MIN_SIGNAL_SCORE, 80)
    }
  };
}

export function executionIsHardBlocked(cfg = getConfig()) {
  const reasons = [];
  if (cfg.botMode !== 'live') reasons.push('BOT_MODE diferente de live');
  if (cfg.accountType !== 'real' && cfg.accountType !== 'demo') reasons.push('ACCOUNT_TYPE inválido');
  if (!cfg.enableExecution) reasons.push('ENABLE_ORDER_EXECUTION=false');
  if (cfg.accountType === 'real' && !cfg.allowLiveTrading) reasons.push('ALLOW_LIVE_TRADING=false');
  if (cfg.brokerConnector === 'deriv_api' && !cfg.deriv.enableOrderExecution) reasons.push('DERIV_ENABLE_ORDER_EXECUTION=false');
  return { blocked: reasons.length > 0, reasons };
}
