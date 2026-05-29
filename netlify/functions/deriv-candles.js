import { json, safeError, num } from '../../lib/http.js';
import { getCandles } from '../../lib/derivClient.js';

export async function handler(event) {
  try {
    const params = new URLSearchParams(event.rawQuery || '');
    const symbol = params.get('symbol') || 'frxEURUSD';
    const granularity = num(params.get('granularity'), 3600);
    const count = num(params.get('count'), 240);
    const candles = await getCandles(symbol, granularity, count);
    return json(200, { ok: true, symbol, granularity, count: candles.length, candles });
  } catch (err) {
    return json(500, { ok: false, error: safeError(err) });
  }
}
