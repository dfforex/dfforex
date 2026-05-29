import { json, options, safeJsonParse } from '../../lib/http.js';
import { getConfig, executionIsHardBlocked } from '../../lib/config.js';
import { createCommand } from '../../lib/mt5Bridge.js';

const allowed = new Set(['START_BOT', 'PAUSE_BOT', 'RUN_SCAN', 'CLOSE_ALL', 'SET_ACCOUNT_TYPE', 'SYNC_NOW']);

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return options();
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Use POST' });
  try {
    const cfg = getConfig();
    const body = safeJsonParse(event.body, {});
    const action = String(body.action || '').toUpperCase();
    if (!allowed.has(action)) return json(400, { ok: false, error: `Ação inválida: ${action}` });

    const hard = executionIsHardBlocked(cfg);
    const payload = { ...(body.payload || {}), ui_account_type: body.account_type || cfg.accountType };
    if (['START_BOT', 'RUN_SCAN', 'CLOSE_ALL'].includes(action) && hard.blocked) {
      payload.execution_blocked = true;
      payload.block_reasons = hard.reasons;
    }

    const command = await createCommand({
      bridgeId: body.bridge_id || cfg.mt5.bridgeId,
      action,
      payload,
      source: 'dashboard',
      requestedBy: body.requested_by || 'DF Forex Pro Panel'
    });
    return json(200, { ok: true, command, execution_blocked: Boolean(payload.execution_blocked), block_reasons: payload.block_reasons || [] });
  } catch (err) {
    return json(500, { ok: false, error: err.message });
  }
}
