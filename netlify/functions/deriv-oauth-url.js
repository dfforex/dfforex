import { json } from '../../lib/http.js';
import { getConfig } from '../../lib/config.js';
import { buildLegacyOAuthUrl } from '../../lib/derivAuth.js';

export async function handler() {
  const cfg = getConfig();
  return json(200, {
    ok: true,
    mode: 'legacy_oauth_websocket',
    app_id: cfg.deriv.legacyAppId,
    authorize_url: buildLegacyOAuthUrl({ appId: cfg.deriv.legacyAppId }),
    callback_hint: 'Cadastre no painel da Deriv API o Website URL como https://SEU-SITE.netlify.app/deriv-callback.html'
  });
}
