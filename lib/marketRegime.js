import { ema, atr } from './indicators.js';

export function classifyMarket(candles) {
  if (!candles || candles.length < 210) {
    return { regime: 'insufficient_data', trend: 'none', confidence: 0, reason: 'Poucos candles para classificar' };
  }
  const closes = candles.map((c) => c.close);
  const ema50 = ema(closes, 50);
  const ema200 = ema(closes, 200);
  const atr14 = atr(candles, 14);
  const last = closes.at(-1);
  const e50 = ema50.at(-1);
  const e200 = ema200.at(-1);
  const prevE200 = ema200.at(-10) || e200;
  const latestAtr = atr14.at(-1) || 0;
  const atrPct = latestAtr / last;
  const slope = (e200 - prevE200) / prevE200;

  if (atrPct > 0.018) {
    return { regime: 'extreme_volatility', trend: 'blocked', confidence: 70, reason: 'Volatilidade acima do limite inicial' };
  }
  if (e50 > e200 && last > e200 && slope > -0.0005) {
    return { regime: 'uptrend', trend: 'buy_only', confidence: 75, ema50: e50, ema200: e200, atrPct };
  }
  if (e50 < e200 && last < e200 && slope < 0.0005) {
    return { regime: 'downtrend', trend: 'sell_only', confidence: 75, ema50: e50, ema200: e200, atrPct };
  }
  return { regime: 'range_or_noisy', trend: 'neutral', confidence: 50, ema50: e50, ema200: e200, atrPct };
}
