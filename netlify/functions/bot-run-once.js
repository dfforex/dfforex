import { json, safeError } from '../../lib/http.js';
import { getConfig } from '../../lib/config.js';
import { getCandles } from '../../lib/derivClient.js';
import { trendPullbackSignal } from '../../lib/strategyTrendPullback.js';
import { evaluateRisk } from '../../lib/riskEngine.js';
import { getSupabaseAdmin, insertLog } from '../../lib/supabaseAdmin.js';

export async function handler() {
  const cfg = getConfig();
  const granularitySeconds = Number(cfg.timeframeMinutes || 60) * 60;
  const supabase = getSupabaseAdmin();

  try {
    const results = [];
    for (const symbol of cfg.symbols) {
      const candles = await getCandles(symbol, granularitySeconds, 240);
      const signal = trendPullbackSignal(candles, symbol, cfg);
      const risk = evaluateRisk(signal, { dailyLossPct: 0, weeklyLossPct: 0, monthlyDrawdownPct: 0 }, cfg);
      const item = { signal, risk };
      results.push(item);

      if (supabase) {
        const row = {
          symbol,
          timeframe: `${cfg.timeframeMinutes}m`,
          strategy_name: signal.strategy_name,
          direction: signal.direction,
          entry_price: signal.entry_price,
          stop_loss: signal.stop_loss,
          take_profit: signal.take_profit,
          risk_reward: signal.risk_reward,
          score: signal.score,
          market_regime: signal.market_regime,
          approved: signal.approved && risk.allowed,
          rejection_reason: risk.allowed ? signal.rejection_reason : risk.issues.join('; '),
          payload: { reasons: signal.reasons, risk }
        };
        await supabase.from('strategy_signals').insert(row);
        if (!row.approved) {
          await supabase.from('strategy_rejections').insert({
            symbol,
            strategy_name: signal.strategy_name,
            direction: signal.direction,
            score: signal.score,
            reason: row.rejection_reason,
            payload: row.payload
          });
        }
      }
    }
    await insertLog('info', 'bot-run-once executado', { count: results.length });
    return json(200, {
      ok: true,
      mode: cfg.botMode,
      execution: 'dry_run_or_blocked_by_default',
      results
    });
  } catch (err) {
    await insertLog('error', 'Erro em bot-run-once', { error: safeError(err) });
    return json(500, { ok: false, error: safeError(err) });
  }
}
