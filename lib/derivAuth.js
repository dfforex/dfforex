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

export function buildLegacyOAuthUrl({ appId, lang = 'PT' } = {}) {
  const finalAppId = appId || getConfig().deriv.legacyAppId || '1089';
  const url = new URL('https://oauth.deriv.com/oauth2/authorize');
  url.searchParams.set('app_id', finalAppId);
  if (lang) url.searchParams.set('l', lang);
  return url.toString();
}

export function getSafeAuthStatus() {
  const cfg = getConfig();
  return {
    auth_mode: cfg.deriv.authMode,
    legacy_oauth: {
      enabled: Boolean(cfg.deriv.legacyAppId),
      app_id: cfg.deriv.legacyAppId,
      authorize_url: buildLegacyOAuthUrl({ appId: cfg.deriv.legacyAppId })
    },
    oauth2_pkce: {
      enabled: Boolean(cfg.deriv.oauth2.clientId && cfg.deriv.oauth2.redirectUri),
      client_id_configured: Boolean(cfg.deriv.oauth2.clientId),
      redirect_uri_configured: Boolean(cfg.deriv.oauth2.redirectUri),
      scope: cfg.deriv.oauth2.scope
    },
    pat_env: {
      demo_token_configured: Boolean(cfg.deriv.tokenDemo),
      live_token_configured: Boolean(cfg.deriv.tokenLive)
    }
  };
}
