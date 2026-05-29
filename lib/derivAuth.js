import crypto from 'node:crypto';
import { getConfig } from './config.js';

export function getRequestDerivToken(event = {}) {
  const headers = event.headers || {};
  const auth = headers.authorization || headers.Authorization || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim();
    if (token) return { token, source: 'browser_deriv_login' };
  }

  const cfg = getConfig();
  const envToken = cfg.accountType === 'real' ? cfg.deriv.tokenLive : cfg.deriv.tokenDemo;
  if (envToken) return { token: envToken, source: cfg.accountType === 'real' ? 'env_live_token' : 'env_demo_token' };

  return { token: '', source: 'none' };
}

export function maskToken(token = '') {
  if (!token) return '';
  if (token.length <= 12) return '***';
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

function base64url(buffer) {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function generatePkcePair() {
  const codeVerifier = base64url(crypto.randomBytes(64));
  const codeChallenge = base64url(crypto.createHash('sha256').update(codeVerifier).digest());
  const state = base64url(crypto.randomBytes(24));
  return { codeVerifier, codeChallenge, state };
}

export function buildOAuth2PkceUrl({ clientId, redirectUri, scope = 'trade account_manage', state, codeChallenge, legacyAppId } = {}) {
  if (!clientId) throw new Error('DERIV_OAUTH_CLIENT_ID não configurado');
  if (!redirectUri) throw new Error('DERIV_OAUTH_REDIRECT_URI/PUBLIC_SITE_URL não configurado');
  if (!state || !codeChallenge) throw new Error('PKCE state/code_challenge ausente');
  const url = new URL('https://auth.deriv.com/oauth2/auth');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', scope);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  if (legacyAppId && legacyAppId !== '1089') url.searchParams.set('app_id', legacyAppId);
  return url.toString();
}

export function buildLegacyOAuthUrl({ appId, lang = 'PT', state } = {}) {
  const finalAppId = appId || getConfig().deriv.legacyAppId || '1089';
  const url = new URL('https://oauth.deriv.com/oauth2/authorize');
  url.searchParams.set('app_id', finalAppId);
  if (lang) url.searchParams.set('l', lang);
  if (state) url.searchParams.set('state', state);
  return url.toString();
}

export function getSafeAuthStatus() {
  const cfg = getConfig();
  const callbackUrl = cfg.deriv.oauth2.redirectUri || ((process.env.PUBLIC_SITE_URL || '').replace(/\/$/, '') + '/deriv-callback.html');
  const legacyAppLooksDefault = !cfg.deriv.legacyAppId || cfg.deriv.legacyAppId === '1089';
  return {
    auth_mode: cfg.deriv.authMode,
    callback_url: callbackUrl,
    legacy_oauth: {
      enabled: Boolean(cfg.deriv.legacyAppId),
      app_id: cfg.deriv.legacyAppId,
      app_id_default_warning: legacyAppLooksDefault,
      authorize_url: buildLegacyOAuthUrl({ appId: cfg.deriv.legacyAppId }),
      setup_hint: 'No app/API legacy da Deriv, o Website URL precisa ser exatamente https://df-forex.netlify.app/deriv-callback.html.'
    },
    oauth2_pkce: {
      enabled: Boolean(cfg.deriv.oauth2.clientId),
      client_id_configured: Boolean(cfg.deriv.oauth2.clientId),
      redirect_uri_configured: Boolean(callbackUrl),
      redirect_uri: callbackUrl,
      scope: cfg.deriv.oauth2.scope
    },
    pat_env: {
      demo_token_configured: Boolean(cfg.deriv.tokenDemo),
      live_token_configured: Boolean(cfg.deriv.tokenLive)
    }
  };
}
