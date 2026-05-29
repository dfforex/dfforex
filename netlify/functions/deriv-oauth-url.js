import { json, safeError } from '../../lib/http.js';
import { getConfig } from '../../lib/config.js';
import { buildLegacyOAuthUrl } from '../../lib/derivAuth.js';

function getOrigin(event) {
  const proto = event.headers['x-forwarded-proto'] || 'https';
  const host = event.headers.host || process.env.PUBLIC_SITE_HOST || 'df-forex.netlify.app';
  return (process.env.PUBLIC_SITE_URL || `${proto}://${host}`).replace(/\/$/, '');
}

export async function handler(event) {
  try {
    const cfg = getConfig();
    const origin = getOrigin(event);
    const params = event.queryStringParameters || {};
    const appIdOverride = String(params.app_id || '').trim();
    const callbackUrl = `${origin}/deriv-callback.html`;
    const appId = appIdOverride || cfg.deriv.legacyAppId || cfg.deriv.appId;

    if (!appId) {
      return json(400, {
        ok: false,
        mode: 'legacy_oauth',
        callback_url: callbackUrl,
        setup_ok: false,
        error: 'App ID Deriv ausente.',
        setup_hint: 'Crie um app no Application Manager da Deriv, configure o Website/OAuth Redirect URL como https://df-forex.netlify.app/deriv-callback.html e informe o App ID no painel ou no Netlify como DERIV_LEGACY_APP_ID.'
      });
    }

    return json(200, {
      ok: true,
      mode: 'legacy_oauth',
      app_id: String(appId),
      authorize_url: buildLegacyOAuthUrl({ appId, lang: 'PT' }),
      callback_url: callbackUrl,
      setup_ok: true,
      app_id_source: appIdOverride ? 'painel' : 'netlify_env',
      setup_hint: 'Você será enviado para a tela oficial da Deriv. Faça login com e-mail/senha na Deriv; depois ela deve voltar automaticamente para o callback cadastrado.'
    });
  } catch (err) {
    return json(500, { ok: false, error: safeError(err) });
  }
}
