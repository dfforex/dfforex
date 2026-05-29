import { json, safeError } from '../../lib/http.js';
import { getConfig } from '../../lib/config.js';
import { buildLegacyOAuthUrl, buildOAuth2PkceUrl, generatePkcePair } from '../../lib/derivAuth.js';

function getOrigin(event) {
  const proto = event.headers['x-forwarded-proto'] || 'https';
  const host = event.headers.host || process.env.PUBLIC_SITE_HOST || 'df-forex.netlify.app';
  return (process.env.PUBLIC_SITE_URL || `${proto}://${host}`).replace(/\/$/, '');
}

export async function handler(event) {
  try {
    const cfg = getConfig();
    const origin = getOrigin(event);
    const callbackUrl = (cfg.deriv.oauth2.redirectUri || `${origin}/deriv-callback.html`).trim();

    // Preferência: OAuth 2.0 PKCE, porque permite redirect_uri explícito e retorno automático confiável.
    if (cfg.deriv.oauth2.clientId) {
      const pkce = generatePkcePair();
      const authorizeUrl = buildOAuth2PkceUrl({
        clientId: cfg.deriv.oauth2.clientId,
        redirectUri: callbackUrl,
        scope: cfg.deriv.oauth2.scope,
        state: pkce.state,
        codeChallenge: pkce.codeChallenge,
        legacyAppId: cfg.deriv.legacyAppId
      });
      return json(200, {
        ok: true,
        mode: 'oauth2_pkce',
        authorize_url: authorizeUrl,
        callback_url: callbackUrl,
        state: pkce.state,
        code_verifier: pkce.codeVerifier,
        setup_ok: true,
        setup_hint: 'OAuth2 PKCE ativo. A Deriv deve retornar para callback_url com code e state.'
      });
    }

    // Fallback: OAuth legado. Neste modo a Deriv só volta para o painel se o Website URL do app_id estiver correto.
    const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const legacyDefaultWarning = !cfg.deriv.legacyAppId || cfg.deriv.legacyAppId === '1089';
    return json(200, {
      ok: true,
      mode: 'legacy_oauth_websocket',
      app_id: cfg.deriv.legacyAppId,
      authorize_url: buildLegacyOAuthUrl({ appId: cfg.deriv.legacyAppId, state }),
      callback_url: callbackUrl,
      state,
      setup_ok: !legacyDefaultWarning,
      warning: legacyDefaultWarning
        ? 'DERIV_LEGACY_APP_ID está vazio ou usando 1089. Com app_id padrão a Deriv pode mandar para home.deriv.com em vez do seu painel.'
        : '',
      setup_hint: 'Cadastre no app/API legacy da Deriv o Website URL exatamente como callback_url. Para seu site: https://df-forex.netlify.app/deriv-callback.html'
    });
  } catch (err) {
    return json(500, { ok: false, error: safeError(err) });
  }
}
