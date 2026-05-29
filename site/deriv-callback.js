const output = document.getElementById('callbackOutput');
const STORAGE = {
  token: 'df_deriv_token',
  loginid: 'df_deriv_loginid',
  currency: 'df_deriv_currency',
  accounts: 'df_deriv_accounts',
  accountsFull: 'df_deriv_accounts_full',
  returnTo: 'df_deriv_return_to'
};

document.getElementById('btnGoHome').addEventListener('click', () => goHome('connected'));
document.getElementById('btnClear').addEventListener('click', () => {
  for (const key of Object.values(STORAGE)) {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  }
  output.textContent = 'Conexão local removida. Voltando ao painel...';
  setTimeout(() => goHome('error'), 500);
});

function paramsFromUrl() {
  const query = new URLSearchParams(window.location.search || '');
  const hash = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
  return { query, hash };
}

function collectLegacyAccounts(params) {
  const accounts = [];
  for (let i = 1; i <= 20; i++) {
    const acct = params.query.get(`acct${i}`) || params.hash.get(`acct${i}`);
    const token = params.query.get(`token${i}`) || params.hash.get(`token${i}`);
    const currency = params.query.get(`cur${i}`) || params.hash.get(`cur${i}`);
    if (acct && token) accounts.push({ acct, token, currency: (currency || '').toUpperCase() });
  }
  return accounts;
}

function saveAccount(account) {
  sessionStorage.setItem(STORAGE.token, account.token);
  sessionStorage.setItem(STORAGE.loginid, account.acct);
  sessionStorage.setItem(STORAGE.currency, account.currency || '');
}

function goHome(status = 'connected') {
  const stored = sessionStorage.getItem(STORAGE.returnTo) || '/';
  let target = stored && stored.startsWith('/') ? stored : '/';
  const url = new URL(target, window.location.origin);
  url.searchParams.set('deriv', status);
  window.location.replace(url.toString());
}

async function processCallback() {
  const params = paramsFromUrl();
  const error = params.query.get('error') || params.hash.get('error');
  if (error) {
    output.textContent = `Login cancelado ou rejeitado pela Deriv. Voltando ao painel...`;
    setTimeout(() => goHome('error'), 900);
    return;
  }

  const legacyAccounts = collectLegacyAccounts(params);
  if (legacyAccounts.length) {
    sessionStorage.setItem(STORAGE.accounts, JSON.stringify(legacyAccounts.map(({ acct, currency }) => ({ acct, currency, mode: /^VRTC/i.test(acct) ? 'demo' : 'real' }))));
    sessionStorage.setItem(STORAGE.accountsFull, JSON.stringify(legacyAccounts.map(({ acct, token, currency }) => ({ acct, token, currency, mode: /^VRTC/i.test(acct) ? 'demo' : 'real' }))));
    const demo = legacyAccounts.find((a) => /^VRTC/i.test(a.acct));
    const selected = demo || legacyAccounts[0];
    saveAccount(selected);
    output.textContent = `Conta Deriv conectada: ${selected.acct}. Contas disponíveis: ${legacyAccounts.map(a => a.acct).join(', ')}. Voltando automaticamente para o painel...`;
    setTimeout(() => goHome('connected'), 350);
    return;
  }

  const code = params.query.get('code');
  const state = params.query.get('state');
  const expectedState = sessionStorage.getItem('df_deriv_oauth_state');
  const codeVerifier = sessionStorage.getItem('df_deriv_pkce_code_verifier');
  if (code) {
    if (!expectedState || state !== expectedState) {
      output.textContent = 'State OAuth inválido. Voltando ao painel...';
      setTimeout(() => goHome('error'), 900);
      return;
    }
    if (!codeVerifier) {
      output.textContent = 'code_verifier não encontrado. Gere o login novamente.';
      setTimeout(() => goHome('error'), 1200);
      return;
    }
    const res = await fetch('/api/deriv-oauth-exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, code_verifier: codeVerifier, redirect_uri: window.location.origin + '/deriv-callback.html' })
    });
    const data = await res.json();
    if (!data.ok) {
      output.textContent = `Falha no OAuth2 Deriv. Voltando ao painel...`;
      setTimeout(() => goHome('error'), 1200);
      return;
    }
    sessionStorage.setItem(STORAGE.token, data.access_token);
    sessionStorage.setItem(STORAGE.loginid, data.loginid || 'oauth2_pkce');
    sessionStorage.setItem(STORAGE.currency, data.currency || '');
    sessionStorage.removeItem('df_deriv_oauth_state');
    sessionStorage.removeItem('df_deriv_pkce_code_verifier');
    output.textContent = 'OAuth2 conectado. Voltando automaticamente para o painel...';
    setTimeout(() => goHome('connected'), 350);
    return;
  }

  output.textContent = `Não encontrei token de sessão Deriv no retorno. Verifique se o Website URL do app Deriv está configurado como ${window.location.origin}/deriv-callback.html. Voltando ao painel...`;
  setTimeout(() => goHome('error'), 2200);
}

processCallback().catch((err) => {
  output.textContent = `Erro ao processar callback Deriv: ${err.message}. Voltando ao painel...`;
  setTimeout(() => goHome('error'), 1400);
});
