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
    const authMode = String(cfg.deriv.authMode || 'legacy_oauth').toLowerCase();

    // Modo recomendado para este projeto agora: OAuth legado da Deriv, porque ele retorna token1/acct1 direto
    // para o Website URL cadastrado no Application Manager. Evitamos cair em 404 quando não há client OAuth2 válido.
    if (authMode !== 'oauth2_pkce') {
      const appId = cfg.deriv.legacyAppId || cfg.deriv.appId;
      if (!appId) {
        return json(400, {
          ok: false,
          mode: 'legacy_oauth',
          callback_url: callbackUrl,
          setup_ok: false,
          error: 'DERIV_LEGACY_APP_ID não configurado no Netlify.',
          setup_hint: 'Crie/abra seu app em api.deriv.com > Applications/Application Manager, copie o App ID e coloque no Netlify como DERIV_LEGACY_APP_ID. No app da Deriv, configure o Website/OAuth Redirect URL exatamente como https://df-forex.netlify.app/deriv-callback.html.'
        });
      }
      const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
      return json(200, {
        ok: true,
        mode: 'legacy_oauth',
        app_id: appId,
        authorize_url: buildLegacyOAuthUrl({ appId, state }),
        callback_url: callbackUrl,
        state,
        setup_ok: true,
        setup_hint: 'Depois do login, a Deriv deve retornar para o Website/OAuth Redirect URL cadastrado no app.'
      });
    }

    // OAuth2 PKCE só deve ser usado se você realmente tiver client_id OAuth2 moderno registrado.
    if (!cfg.deriv.oauth2.clientId) {
      return json(400, {
        ok: false,
        mode: 'oauth2_pkce',
        callback_url: callbackUrl,
        setup_ok: false,
        error: 'DERIV_AUTH_MODE=oauth2_pkce, mas DERIV_OAUTH_CLIENT_ID não está configurado.',
        setup_hint: 'Para evitar 404, use DERIV_AUTH_MODE=legacy_oauth com DERIV_LEGACY_APP_ID, ou configure um client OAuth2 PKCE válido com redirect_uri exato.'
      });
    }

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
  } catch (err) {
    return json(500, { ok: false, error: safeError(err) });
  }
}
