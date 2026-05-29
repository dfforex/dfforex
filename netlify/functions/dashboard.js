import { json, safeError } from '../../lib/http.js';
import { getConfig } from '../../lib/config.js';
import { getSupabaseAdmin } from '../../lib/supabaseAdmin.js';

export async function handler() {
  const cfg = getConfig();
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return json(200, fallbackDashboard(cfg, 'Supabase ainda não configurado no ambiente do Netlify'));
  }

  try {
    const [signals, orders, risks, perf, logs] = await Promise.all([
      supabase.from('strategy_signals').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('trade_orders').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('risk_events').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('daily_performance').select('*').order('trade_date', { ascending: false }).limit(10),
      supabase.from('bot_runtime_logs').select('*').order('created_at', { ascending: false }).limit(20)
    ]);

    const errors = [signals, orders, risks, perf, logs].map((r) => r.error?.message).filter(Boolean);
    return json(200, {
      ok: true,
      source: 'supabase',
      warnings: errors,
      status: {
        mode: cfg.botMode,
        account_type: cfg.accountType,
        broker: cfg.brokerConnector,
        symbols: cfg.symbols,
        risk: cfg.risk
      },
      signals: signals.data || [],
      orders: orders.data || [],
      risk_events: risks.data || [],
      daily_performance: perf.data || [],
      logs: logs.data || []
    });
  } catch (err) {
    return json(500, { ok: false, error: safeError(err) });
  }
}

function fallbackDashboard(cfg, warning) {
  return {
    ok: true,
    source: 'local_fallback',
    warning,
    status: {
      mode: cfg.botMode,
      account_type: cfg.accountType,
      broker: cfg.brokerConnector,
      symbols: cfg.symbols,
      risk: cfg.risk
    },
    signals: [],
    orders: [],
    risk_events: [],
    daily_performance: [],
    logs: []
  };
}
