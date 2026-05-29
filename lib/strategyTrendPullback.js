import { ema, atr, normalizeCandles } from './indicators.js';
import { classifyMarket } from './marketRegime.js';

export function trendPullbackSignal(rawCandles, symbol, cfg) {
  const candles = normalizeCandles(rawCandles);
  const minScore = cfg?.risk?.minSignalScore || 80;
  if (candles.length < 210) {
    return reject(symbol, 'DF_TREND_PULLBACK_CORE', 'Poucos candles para análise', 0, candles.at(-1));
  }
  const closes = candles.map((c) => c.close);
  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  const ema200 = ema(closes, 200);
  const atr14 = atr(candles, 14);
  const lastCandle = candles.at(-1);
  const prevCandle = candles.at(-2);
  const last = lastCandle.close;
  const e20 = ema20.at(-1);
  const e50 = ema50.at(-1);
  const e200 = ema200.at(-1);
  const a = atr14.at(-1) || Math.abs(last * 0.002);
  const regime = classifyMarket(candles);

  let direction = null;
  let score = 0;
  const reasons = [];

  if (regime.regime === 'uptrend') {
    direction = 'buy';
    score += 25; reasons.push('Tendência de alta');
    if (e50 > e200) { score += 15; reasons.push('EMA50 acima da EMA200'); }
    if (last > e200) { score += 10; reasons.push('Preço acima da EMA200'); }
    if (lastCandle.low <= e20 || lastCandle.low <= e50) { score += 15; reasons.push('Pullback tocou região EMA20/EMA50'); }
    if (lastCandle.close > lastCandle.open && lastCandle.close > prevCandle.close) { score += 15; reasons.push('Candle de confirmação comprador'); }
  } else if (regime.regime === 'downtrend') {
    direction = 'sell';
    score += 25; reasons.push('Tendência de baixa');
    if (e50 < e200) { score += 15; reasons.push('EMA50 abaixo da EMA200'); }
    if (last < e200) { score += 10; reasons.push('Preço abaixo da EMA200'); }
    if (lastCandle.high >= e20 || lastCandle.high >= e50) { score += 15; reasons.push('Pullback tocou região EMA20/EMA50'); }
    if (lastCandle.close < lastCandle.open && lastCandle.close < prevCandle.close) { score += 15; reasons.push('Candle de confirmação vendedor'); }
  } else {
    return reject(symbol, 'DF_TREND_PULLBACK_CORE', `Regime bloqueado: ${regime.regime}`, 30, lastCandle, regime);
  }

  score += 10; reasons.push('ATR calculado');
  score += 5; reasons.push('Estratégia em dry-run sem filtro de notícia real');
  score = Math.min(score, 100);

  const stopDistance = Math.max(a * 1.2, Math.abs(last * 0.0015));
  const entry = last;
  const stopLoss = direction === 'buy' ? entry - stopDistance : entry + stopDistance;
  const takeProfit = direction === 'buy' ? entry + stopDistance * 1.8 : entry - stopDistance * 1.8;
  const approved = score >= minScore;

  return {
    approved,
    symbol,
    strategy_name: 'DF_TREND_PULLBACK_CORE',
    direction,
    score,
    entry_price: round(entry),
    stop_loss: round(stopLoss),
    take_profit: round(takeProfit),
    risk_reward: 1.8,
    market_regime: regime.regime,
    reasons,
    rejection_reason: approved ? null : `Score ${score} abaixo do mínimo ${minScore}`,
    candle_epoch: lastCandle.epoch
  };
}

function reject(symbol, strategy, reason, score = 0, candle = null, regime = null) {
  return {
    approved: false,
    symbol,
    strategy_name: strategy,
    direction: 'none',
    score,
    entry_price: candle?.close ?? null,
    stop_loss: null,
    take_profit: null,
    risk_reward: null,
    market_regime: regime?.regime || 'unknown',
    reasons: [reason],
    rejection_reason: reason,
    candle_epoch: candle?.epoch || null
  };
}

function round(n) {
  return Number(Number(n).toFixed(6));
}
