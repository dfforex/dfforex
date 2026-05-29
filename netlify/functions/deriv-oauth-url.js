import { json } from '../../lib/http.js';
import { getConfig } from '../../lib/config.js';
import { buildLegacyOAuthUrl } from '../../lib/derivAuth.js';

export async function handler(event) {
  const cfg = getConfig();
  const proto = event.headers['x-forwarded-proto'] || 'https';
  const host = event.headers.host || process.env.PUBLIC_SITE_HOST || 'delicate-longma-e8f8d2.netlify.app';
  const origin = process.env.PUBLIC_SITE_URL || `${proto}://${host}`;
  return json(200, {
    ok: true,
    mode: 'legacy_oauth_websocket',
    app_id: cfg.deriv.legacyAppId,
    authorize_url: buildLegacyOAuthUrl({ appId: cfg.deriv.legacyAppId }),
    callback_url: `${origin.replace(/\/$/, '')}/deriv-callback.html`,
    callback_hint: 'Cadastre no app da Deriv o Website URL exatamente como callback_url.'
  });
}
