import { executionIsHardBlocked } from './config.js';

export function evaluateRisk(signal, account = {}, cfg) {
  const hard = executionIsHardBlocked(cfg);
  const issues = [...hard.reasons];
  const risk = cfg.risk;
  if (!signal?.approved) issues.push(signal?.rejection_reason || 'Sinal não aprovado');
  if (!signal?.stop_loss) issues.push('Stop loss ausente');
  if (!signal?.take_profit) issues.push('Take profit ausente');
  if ((risk.maxRiskPerTradePct || 0) > 2) issues.push('Risco por trade acima do limite absoluto de 2%');
  if (Number(account.dailyLossPct || 0) >= risk.maxDailyLossPct) issues.push('Limite de perda diária atingido');
  if (Number(account.weeklyLossPct || 0) >= risk.maxWeeklyLossPct) issues.push('Limite de perda semanal atingido');
  if (Number(account.monthlyDrawdownPct || 0) >= risk.maxMonthlyDrawdownPct) issues.push('Drawdown mensal atingido');
  return {
    allowed: issues.length === 0,
    mode: cfg.botMode,
    account_type: cfg.accountType,
    issues,
    max_risk_per_trade_pct: risk.maxRiskPerTradePct
  };
}

export function calculatePositionSize({ equity = 1000, riskPct = 0.5, entry, stopLoss, pipValue = 10 }) {
  const riskMoney = equity * (riskPct / 100);
  const distance = Math.abs(Number(entry) - Number(stopLoss));
  if (!distance || !Number.isFinite(distance)) return 0;
  const lots = riskMoney / (distance * pipValue * 10000);
  return Math.max(0, Number(lots.toFixed(2)));
}
