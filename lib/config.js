import { parseBool, num } from './http.js';

export function getConfig() {
  const accountType = process.env.ACCOUNT_TYPE || 'demo';
  const botMode = process.env.BOT_MODE || 'dry_run';
  const enableExecution = parseBool(process.env.ENABLE_ORDER_EXECUTION, false);
  const allowLive = parseBool(process.env.ALLOW_LIVE_TRADING, false);

  return {
    appVersion: '3.1.0-mt5-bridge',
    publicSiteUrl: (process.env.PUBLIC_SITE_URL || 'https://df-forex.netlify.app').replace(/\/$/, ''),
    botMode,
    accountType,
    brokerConnector: process.env.BROKER_CONNECTOR || 'mt5_bridge',
    enableExecution,
    allowLiveTrading: allowLive,
    supabase: {
      url: process.env.SUPABASE_URL || '',
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    },
    mt5: {
      bridgeId: process.env.MT5_BRIDGE_ID || 'df-forex-main',
      bridgeSecret: process.env.MT5_BRIDGE_SECRET || '',
      brokerName: process.env.MT5_BROKER_NAME || 'Deriv MT5',
      server: process.env.MT5_SERVER || 'Deriv-Demo',
      login: process.env.MT5_LOGIN || '',
      allowRealTrading: parseBool(process.env.MT5_ALLOW_REAL_TRADING, false),
      minPollSeconds: num(process.env.MT5_MIN_POLL_SECONDS, 5),
      heartbeatMaxAgeSeconds: num(process.env.MT5_HEARTBEAT_MAX_AGE_SECONDS, 180)
    },
    symbols: (process.env.FOREX_SYMBOLS || 'EURUSD,GBPUSD,USDJPY,XAUUSD')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    risk: {
      maxRiskPerTradePct: num(process.env.MAX_RISK_PER_TRADE_PCT, 0.5),
      maxDailyLossPct: num(process.env.MAX_DAILY_LOSS_PCT, 2),
      maxWeeklyLossPct: num(process.env.MAX_WEEKLY_LOSS_PCT, 5),
      maxMonthlyDrawdownPct: num(process.env.MAX_MONTHLY_DRAWDOWN_PCT, 10),
      minSignalScore: num(process.env.MIN_SIGNAL_SCORE, 80),
      maxTradesPerDay: num(process.env.MAX_TRADES_PER_DAY, 5),
      maxOpenPositions: num(process.env.MAX_OPEN_POSITIONS, 2)
    }
  };
}

export function executionIsHardBlocked(cfg = getConfig()) {
  const reasons = [];
  if (cfg.botMode !== 'live') reasons.push('BOT_MODE diferente de live');
  if (cfg.accountType !== 'real' && cfg.accountType !== 'demo') reasons.push('ACCOUNT_TYPE inválido');
  if (!cfg.enableExecution) reasons.push('ENABLE_ORDER_EXECUTION=false');
  if (cfg.accountType === 'real' && !cfg.allowLiveTrading) reasons.push('ALLOW_LIVE_TRADING=false');
  if (cfg.accountType === 'real' && !cfg.mt5.allowRealTrading) reasons.push('MT5_ALLOW_REAL_TRADING=false');
  return { blocked: reasons.length > 0, reasons };
}
