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


export function getRequestDerivAppId(event = {}) {
  const headers = event.headers || {};
  const headerAppId = headers['x-deriv-app-id'] || headers['X-Deriv-App-Id'] || headers['deriv-app-id'] || headers['Deriv-App-Id'] || '';
  const queryAppId = event.queryStringParameters?.app_id || event.queryStringParameters?.appId || '';
  const cfg = getConfig();
  const raw = String(headerAppId || queryAppId || cfg.deriv.appId || cfg.deriv.legacyAppId || '').trim();
  return raw;
}

export function maskToken(token = '') {
  if (!token) return '';
  if (token.length <= 12) return '***';
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

function base64url(buffer) {
  return Buffer.from(buffer).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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
  if (legacyAppId) url.searchParams.set('app_id', legacyAppId);
  return url.toString();
}

export function buildLegacyOAuthUrl({ appId, lang = 'PT', state } = {}) {
  const finalAppId = String(appId || '').trim();
  if (!finalAppId) throw new Error('DERIV_LEGACY_APP_ID/DERIV_APP_ID não configurado');
  const url = new URL('https://oauth.deriv.com/oauth2/authorize');
  url.searchParams.set('app_id', finalAppId);
  // Mantemos a URL mínima porque o OAuth legado da Deriv usa o Website URL cadastrado no App.
  if (lang) url.searchParams.set('l', lang);
  return url.toString();
}

export function getSafeAuthStatus() {
  const cfg = getConfig();
  const callbackUrl = cfg.deriv.oauth2.redirectUri || ((process.env.PUBLIC_SITE_URL || '').replace(/\/$/, '') + '/deriv-callback.html');
  const legacyConfigured = Boolean(cfg.deriv.legacyAppId);
  return {
    auth_mode: cfg.deriv.authMode,
    callback_url: callbackUrl,
    legacy_oauth: {
      enabled: legacyConfigured,
      app_id_configured: legacyConfigured,
      app_id: cfg.deriv.legacyAppId ? String(cfg.deriv.legacyAppId) : '',
      authorize_url: legacyConfigured ? buildLegacyOAuthUrl({ appId: cfg.deriv.legacyAppId }) : '',
      setup_hint: 'No Application Manager da Deriv, o Website/OAuth Redirect URL precisa estar exatamente https://df-forex.netlify.app/deriv-callback.html.'
    },
    oauth2_pkce: {
      enabled: cfg.deriv.authMode === 'oauth2_pkce' && Boolean(cfg.deriv.oauth2.clientId),
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
