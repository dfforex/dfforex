const output = document.getElementById('callbackOutput');
const STORAGE = {
  token: 'df_deriv_token',
  loginid: 'df_deriv_loginid',
  currency: 'df_deriv_currency',
  accounts: 'df_deriv_accounts'
};

document.getElementById('btnGoHome').addEventListener('click', () => { window.location.href = '/'; });
document.getElementById('btnClear').addEventListener('click', () => {
  for (const key of Object.values(STORAGE)) {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  }
  output.textContent = 'Conexão local removida. Voltando ao painel...';
  setTimeout(() => { window.location.href = '/'; }, 900);
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

async function processCallback() {
  const params = paramsFromUrl();
  const error = params.query.get('error') || params.hash.get('error');
  if (error) {
    output.textContent = `Login cancelado ou rejeitado pela Deriv.\n\nErro: ${error}\n${params.query.get('error_description') || params.hash.get('error_description') || ''}`;
    return;
  }

  const legacyAccounts = collectLegacyAccounts(params);
  if (legacyAccounts.length) {
    sessionStorage.setItem(STORAGE.accounts, JSON.stringify(legacyAccounts.map(({ acct, currency }) => ({ acct, currency }))));
    const demo = legacyAccounts.find((a) => /^VRTC/i.test(a.acct));
    const selected = demo || legacyAccounts[0];
    saveAccount(selected);
    output.textContent = `Login Deriv conectado com sucesso.\n\nConta selecionada: ${selected.acct}\nMoeda: ${selected.currency || '-'}\nContas recebidas: ${legacyAccounts.map((a) => `${a.acct}/${a.currency || '-'}`).join(', ')}\n\nVoltando ao painel...`;
    setTimeout(() => { window.location.href = '/'; }, 1600);
    return;
  }

  // Suporte opcional ao OAuth2 moderno com PKCE.
  // Observação: o robô v2 usa WebSocket v3; para operar via WebSocket, prefira o OAuth legado/PAT.
  const code = params.query.get('code');
  const state = params.query.get('state');
  const expectedState = sessionStorage.getItem('df_deriv_oauth_state');
  const codeVerifier = sessionStorage.getItem('df_deriv_pkce_code_verifier');
  if (code) {
    if (!expectedState || state !== expectedState) {
      output.textContent = 'State OAuth inválido. Por segurança, o login foi recusado.';
      return;
    }
    if (!codeVerifier) {
      output.textContent = 'code_verifier não encontrado no navegador. Gere o login novamente.';
      return;
    }
    const res = await fetch('/api/deriv-oauth-exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, code_verifier: codeVerifier, redirect_uri: window.location.origin + '/deriv-callback.html' })
    });
    const data = await res.json();
    if (!data.ok) {
      output.textContent = `Falha no OAuth2 Deriv:\n${JSON.stringify(data, null, 2)}`;
      return;
    }
    sessionStorage.setItem(STORAGE.token, data.access_token);
    sessionStorage.setItem(STORAGE.loginid, 'oauth2_pkce');
    output.textContent = `OAuth2 conectado. Token salvo apenas nesta sessão do navegador.\n\nVoltando ao painel...`;
    sessionStorage.removeItem('df_deriv_oauth_state');
    sessionStorage.removeItem('df_deriv_pkce_code_verifier');
    setTimeout(() => { window.location.href = '/'; }, 1600);
    return;
  }

  output.textContent = `Não encontrei token de sessão Deriv no retorno.\n\nVerifique se o Website URL do app Deriv está configurado como:\n${window.location.origin}/deriv-callback.html\n\nURL recebida:\n${window.location.href}`;
}

processCallback().catch((err) => {
  output.textContent = `Erro ao processar callback Deriv: ${err.message}`;
});
