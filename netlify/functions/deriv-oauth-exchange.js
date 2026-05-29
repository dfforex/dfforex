import { json, safeError } from '../../lib/http.js';
import { getConfig } from '../../lib/config.js';

export async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Use POST' });
  try {
    const cfg = getConfig();
    const body = JSON.parse(event.body || '{}');
    const code = String(body.code || '').trim();
    const codeVerifier = String(body.code_verifier || '').trim();
    const redirectUri = String(body.redirect_uri || cfg.deriv.oauth2.redirectUri || '').trim();

    if (!cfg.deriv.oauth2.clientId) return json(400, { ok: false, error: 'DERIV_OAUTH_CLIENT_ID não configurado no Netlify' });
    if (!redirectUri) return json(400, { ok: false, error: 'DERIV_OAUTH_REDIRECT_URI não configurado/informado' });
    if (!code || !codeVerifier) return json(400, { ok: false, error: 'code e code_verifier são obrigatórios' });

    const params = new URLSearchParams();
    params.set('grant_type', 'authorization_code');
    params.set('client_id', cfg.deriv.oauth2.clientId);
    params.set('code', code);
    params.set('code_verifier', codeVerifier);
    params.set('redirect_uri', redirectUri);

    const res = await fetch('https://auth.deriv.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return json(res.status, { ok: false, error: data.error_description || data.error || 'Falha no token exchange Deriv', details: data });

    return json(200, {
      ok: true,
      token_type: data.token_type,
      expires_in: data.expires_in,
      access_token: data.access_token
    });
  } catch (err) {
    return json(500, { ok: false, error: safeError(err) });
  }
}
