import { getSupabaseAdmin } from './supabaseAdmin.js';
import { getConfig } from './config.js';

export function requireSupabase() {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error('Supabase não configurado no backend. Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no Netlify.');
  return supabase;
}

export function verifyBridgeSecret(event, cfg = getConfig()) {
  const expected = cfg.mt5.bridgeSecret;
  if (!expected) return { ok: true, warning: 'MT5_BRIDGE_SECRET não configurado; validação relaxada.' };
  const got = event.headers['x-bridge-secret'] || event.headers['X-Bridge-Secret'] || '';
  if (got !== expected) return { ok: false, error: 'Bridge secret inválido.' };
  return { ok: true };
}

export function normalizeBridgeId(event, body = {}) {
  return body.bridge_id || event.queryStringParameters?.bridge_id || event.headers['x-bridge-id'] || event.headers['X-Bridge-Id'] || getConfig().mt5.bridgeId;
}

export async function createCommand({ bridgeId, action, payload = {}, source = 'panel', requestedBy = 'dashboard' }) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.from('mt5_commands').insert({
    bridge_id: bridgeId,
    action,
    payload,
    status: 'queued',
    source,
    requested_by: requestedBy
  }).select('*').single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getDashboardSnapshot() {
  const supabase = requireSupabase();
  const cfg = getConfig();
  const bridgeId = cfg.mt5.bridgeId;

  const [statusRes, ordersRes, signalsRes, commandsRes, logsRes, settingsRes] = await Promise.all([
    supabase.from('mt5_bridge_status').select('*').eq('bridge_id', bridgeId).maybeSingle(),
    supabase.from('trade_orders').select('*').order('created_at', { ascending: false }).limit(25),
    supabase.from('strategy_signals').select('*').order('created_at', { ascending: false }).limit(25),
    supabase.from('mt5_commands').select('*').eq('bridge_id', bridgeId).order('created_at', { ascending: false }).limit(20),
    supabase.from('bot_runtime_logs').select('*').order('created_at', { ascending: false }).limit(15),
    supabase.from('mt5_bridge_settings').select('*').eq('bridge_id', bridgeId).maybeSingle()
  ]);

  return {
    config: {
      version: cfg.appVersion,
      bridge_id: bridgeId,
      account_type: cfg.accountType,
      bot_mode: cfg.botMode,
      broker: cfg.brokerConnector,
      mt5_server: cfg.mt5.server,
      mt5_login: cfg.mt5.login,
      symbols: cfg.symbols,
      risk: cfg.risk
    },
    bridge_status: statusRes.data || null,
    settings: settingsRes.data || null,
    orders: ordersRes.data || [],
    signals: signalsRes.data || [],
    commands: commandsRes.data || [],
    logs: logsRes.data || [],
    errors: {
      status: statusRes.error?.message || null,
      orders: ordersRes.error?.message || null,
      signals: signalsRes.error?.message || null,
      commands: commandsRes.error?.message || null,
      logs: logsRes.error?.message || null,
      settings: settingsRes.error?.message || null
    }
  };
}
