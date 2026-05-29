import { json } from '../../lib/http.js';
import { getConfig, executionIsHardBlocked } from '../../lib/config.js';
import { insertLog } from '../../lib/supabaseAdmin.js';

function checkBridgeToken(event) {
  const expected = process.env.MT5_BRIDGE_TOKEN || '';
  if (!expected) return { ok: false, reason: 'MT5_BRIDGE_TOKEN não configurado no Netlify' };
  const got = (event.headers?.authorization || '').replace(/^Bearer\s+/i, '') || event.queryStringParameters?.token || '';
  return got === expected ? { ok: true } : { ok: false, reason: 'Token do bridge inválido' };
}

export async function handler(event) {
  const auth = checkBridgeToken(event);
  if (!auth.ok) return json(401, { ok: false, error: auth.reason });
  const cfg = getConfig();
  const hard = executionIsHardBlocked(cfg);
  const payload = event.httpMethod === 'POST' ? JSON.parse(event.body || '{}') : event.queryStringParameters || {};
  await insertLog('mt5_heartbeat', 'MT5 Bridge heartbeat', {
    ...payload,
    broker: 'deriv_mt5',
    account_type: cfg.accountType,
    blocked: hard.blocked,
    reasons: hard.reasons
  });
  // MVP seguro: por padrão não envia comandos de trade ao EA. As estratégias do painel podem ser ativadas depois via tabela/fila.
  return json(200, {
    ok: true,
    action: 'none',
    broker: 'deriv_mt5',
    mode: cfg.botMode,
    account_type: cfg.accountType,
    execution_blocked: hard.blocked,
    block_reasons: hard.reasons,
    message: hard.blocked ? 'Bridge online; execução bloqueada por segurança.' : 'Bridge online; aguardando fila de comandos.'
  });
}
