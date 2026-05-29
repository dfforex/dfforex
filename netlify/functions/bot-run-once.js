import { json, safeError } from '../../lib/http.js';
import { getConfig, executionIsHardBlocked } from '../../lib/config.js';
import { getCandles } from '../../lib/derivClient.js';
import { getRequestDerivToken } from '../../lib/derivAuth.js';
import { getAuthorizedDerivAccount, buyRiseFallContract } from '../../lib/derivTrading.js';
import { trendPullbackSignal } from '../../lib/strategyTrendPullback.js';
import { evaluateRisk } from '../../lib/riskEngine.js';
import { getSupabaseAdmin, insertLog } from '../../lib/supabaseAdmin.js';

function parseBody(event) {
  try { return event.body ? JSON.parse(event.body) : {}; } catch { return {}; }
}

function deterministicDryRunProfit(signal, stake) {
  const base = Number(stake || 1);
  const score = Number(signal?.score || 0);
  const seed = `${signal?.symbol || ''}-${signal?.direction || ''}-${signal?.candle_epoch || ''}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) % 997;
  const win = (score >= 88) || (hash % 100 < Math.max(52, Math.min(78, score - 10)));
  return Number((win ? base * 0.82 : -base).toFixed(2));
}

export async function handler(event) {
  const cfg = getConfig();
  const body = parseBody(event);
  const granularitySeconds = Number(body.timeframeMinutes || cfg.timeframeMinutes || 60) * 60;
  const stake = Math.max(0.35, Number(body.stake || process.env.DERIV_DEFAULT_STAKE || 1));
  const duration = Math.max(1, Number(body.duration || process.env.DERIV_CONTRACT_DURATION || 5));
  const durationUnit = String(body.durationUnit || process.env.DERIV_CONTRACT_DURATION_UNIT || 'm');
  const requestedMode = String(body.accountMode || cfg.accountType || 'demo').toLowerCase();
  const executeRequested = body.execute === true || body.execute === 'true';
  const maxTradesPerRun = Math.max(1, Number(body.maxTradesPerRun || process.env.MAX_TRADES_PER_RUN || 1));
  const supabase = getSupabaseAdmin();
  const tokenInfo = getRequestDerivToken(event);

  try {
    let account = null;
    if (tokenInfo.token) {
      account = await getAuthorizedDerivAccount(tokenInfo.token);
      if (requestedMode && account.account_mode !== requestedMode) {
        return json(400, {
          ok: false,
          error: `Conta selecionada incompatível: painel pediu ${requestedMode}, mas o token conectado é ${account.account_mode} (${account.loginid}).`,
          account
        });
      }
    } else if (executeRequested) {
      return json(401, { ok: false, error: 'Conecte a Deriv antes de iniciar operações.' });
    }

    const hard = executionIsHardBlocked(cfg);
    const localBlockReasons = [...hard.reasons];
    if (requestedMode === 'real' && !cfg.allowLiveTrading) localBlockReasons.push('Conta real bloqueada: ALLOW_LIVE_TRADING=false');
    if (requestedMode === 'real' && cfg.accountType !== 'real') localBlockReasons.push('Conta real bloqueada: ACCOUNT_TYPE diferente de real');
    if (requestedMode === 'demo' && cfg.accountType !== 'demo' && cfg.accountType !== 'real') localBlockReasons.push('ACCOUNT_TYPE inválido para demo');
    const canSendOrders = executeRequested && tokenInfo.token && localBlockReasons.length === 0 && cfg.deriv.enableOrderExecution;
    const executionMode = canSendOrders ? 'deriv_order_execution' : (executeRequested ? 'dry_run_blocked_or_safe' : 'signal_scan_only');
    const results = [];
    let executedCount = 0;

    for (const symbol of cfg.symbols) {
      const candles = await getCandles(symbol, granularitySeconds, 240);
      const signal = trendPullbackSignal(candles, symbol, cfg);
      const risk = evaluateRisk(signal, { dailyLossPct: 0, weeklyLossPct: 0, monthlyDrawdownPct: 0 }, cfg);
      let signalId = null;

      if (supabase) {
        const row = {
          symbol,
          timeframe: `${granularitySeconds / 60}m`,
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
          payload: { reasons: signal.reasons, risk, account_mode: requestedMode, execution_mode: executionMode }
        };
        const inserted = await supabase.from('strategy_signals').insert(row).select('id').single();
        signalId = inserted.data?.id || null;
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

      let order = null;
      const approvedForOrder = signal.approved && ['buy', 'sell'].includes(signal.direction) && (canSendOrders ? risk.allowed : true);
      if (approvedForOrder && executeRequested && executedCount < maxTradesPerRun) {
        if (canSendOrders) {
          const trade = await buyRiseFallContract({
            token: tokenInfo.token,
            signal,
            stake,
            duration,
            durationUnit,
            currency: account?.currency || 'USD'
          });
          order = {
            account_id: null,
            signal_id: signalId,
            broker: 'deriv_api',
            broker_order_id: String(trade.contract_id || ''),
            symbol,
            strategy_name: signal.strategy_name,
            direction: signal.direction,
            lot_size: 0,
            stake,
            entry_price: signal.entry_price,
            stop_loss: signal.stop_loss,
            take_profit: signal.take_profit,
            status: 'open',
            profit: 0,
            payload: { trade, account, execution_mode: executionMode, duration, durationUnit }
          };
          executedCount += 1;
        } else {
          const profit = deterministicDryRunProfit(signal, stake);
          order = {
            account_id: null,
            signal_id: signalId,
            broker: 'deriv_api',
            broker_order_id: `DRY-${Date.now()}-${symbol}`,
            symbol,
            strategy_name: signal.strategy_name,
            direction: signal.direction,
            lot_size: 0,
            stake,
            entry_price: signal.entry_price,
            stop_loss: signal.stop_loss,
            take_profit: signal.take_profit,
            status: 'dry_run',
            profit,
            closed_at: new Date().toISOString(),
            close_reason: profit >= 0 ? 'dry_run_win' : 'dry_run_loss',
            payload: { account, execution_mode, blocked_reasons: localBlockReasons, simulated: true, duration, durationUnit }
          };
          executedCount += 1;
        }

        if (supabase && order) {
          await supabase.from('trade_orders').insert(order);
        }
      }

      results.push({ signal, risk, order });
    }

    await insertLog('info', 'bot-run-once operacional executado', {
      count: results.length,
      executedCount,
      executionMode,
      requestedMode,
      account: account ? { loginid: account.loginid, account_mode: account.account_mode, currency: account.currency } : null
    });

    return json(200, {
      ok: true,
      mode: cfg.botMode,
      requested_account_mode: requestedMode,
      execution_mode: executionMode,
      execution_requested: executeRequested,
      execution_enabled: canSendOrders,
      block_reasons: localBlockReasons,
      account: account ? { loginid: account.loginid, account_mode: account.account_mode, currency: account.currency, balance: account.balance } : null,
      stake,
      duration,
      duration_unit: durationUnit,
      executed_count: executedCount,
      results
    });
  } catch (err) {
    await insertLog('error', 'Erro em bot-run-once operacional', { error: safeError(err) });
    return json(500, { ok: false, error: safeError(err) });
  }
}
