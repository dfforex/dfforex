const el = (id) => document.getElementById(id);
const outputBox = el('outputBox');
const configBox = el('configBox');
const lastUpdate = el('lastUpdate');
const toast = el('toast');

const STORAGE = {
  token: 'df_deriv_token',
  tokenSource: 'df_deriv_token_source',
  loginid: 'df_deriv_loginid',
  currency: 'df_deriv_currency',
  accounts: 'df_deriv_accounts',
  accountsFull: 'df_deriv_accounts_full',
  returnTo: 'df_deriv_return_to',
  accountMode: 'df_account_mode',
  botRunning: 'df_bot_running',
  stake: 'df_stake',
  duration: 'df_duration',
  derivAppId: 'df_deriv_app_id',
  brokerMode: 'df_broker_mode',
  mt5Server: 'df_mt5_server',
  mt5Login: 'df_mt5_login'
};

const PAGE_META = {
  dashboard: ['Painel principal', 'Dashboard operacional', 'Visão geral do robô, conexão Deriv, risco e performance.'],
  operacao: ['Operação', 'Iniciar operações', 'Conecte a Deriv, selecione Demo ou Real e controle o bot.'],
  signals: ['Estratégias', 'Sinais gerados', 'Sinais aprovados, rejeitados e motivos de decisão.'],
  orders: ['Execução', 'Ordens e resultados', 'Entradas realizadas, status, ganho e perda.'],
  risk: ['Proteção', 'Controle de risco', 'Drawdown, limites e travas de segurança.'],
  strategies: ['Estratégias', 'Motores de decisão', 'Estratégias disponíveis e próximas evoluções.'],
  performance: ['Performance', 'Performance operacional', 'Curva de equity, P/L diário e distribuição de sinais.'],
  broker: ['Integrações', 'Corretora Deriv', 'Status técnico de autenticação e ambiente.'],
  logs: ['Sistema', 'Logs técnicos', 'Retorno das chamadas e diagnóstico.']
};

const DEFAULT_DERIV_APP_ID = ''; // Sem App ID padrão: usar App ID real da Deriv

const DEFAULT_WATCHLIST = [
  { pair: 'EUR/USD', symbol: 'frxEURUSD', price: '1.08854', change: '+0.21%', dir: 'up' },
  { pair: 'GBP/USD', symbol: 'frxGBPUSD', price: '1.27231', change: '-0.12%', dir: 'down' },
  { pair: 'USD/JPY', symbol: 'frxUSDJPY', price: '156.784', change: '+0.34%', dir: 'up' },
  { pair: 'AUD/USD', symbol: 'frxAUDUSD', price: '0.66531', change: '-0.08%', dir: 'down' },
  { pair: 'XAU/USD', symbol: 'frxXAUUSD', price: '2,350.12', change: '+0.47%', dir: 'up' }
];

let botTimer = null;
let lastConfig = null;
let lastDashboard = null;

function bind(id, event, fn) {
  const node = el(id);
  if (node) node.addEventListener(event, fn);
}

bind('btnRefresh', 'click', loadDashboard);
bind('btnSidebarRefresh', 'click', loadDashboard);
bind('btnSignalsRefresh', 'click', loadDashboard);
bind('btnOrdersRefresh', 'click', syncOrders);
bind('btnBrokerTest', 'click', testDeriv);
bind('btnHealth', 'click', () => callApi('/api/health'));
bind('btnDeriv', 'click', testDeriv);
bind('btnDerivLogin', 'click', loginWithDeriv);
bind('btnTopDerivLogin', 'click', () => getDerivLoginId() ? showPage('operacao') : loginWithDeriv());
bind('btnDerivLogout', 'click', logoutDeriv);
bind('btnRun', 'click', () => runScan({ execute: false, source: 'manual_scan' }));
bind('btnStartOperations', 'click', startOperations);
bind('btnStopOperations', 'click', stopOperations);
bind('btnSyncOrders', 'click', syncOrders);
bind('btnTheme', 'click', () => document.body.classList.toggle('light'));
bind('accountModeSelect', 'change', onAccountModeChange);
bind('derivAccountSelect', 'change', onDerivAccountChange);
bind('stakeInput', 'input', () => {
  localStorage.setItem(STORAGE.stake, el('stakeInput').value);
  updateDashboardSelection();
  updateMt5Ui();
}
);
bind('durationSelect', 'change', () => {
  localStorage.setItem(STORAGE.duration, el('durationSelect').value);
  updateDashboardSelection();
});
bind('derivAppIdInputOauth', 'input', () => localStorage.setItem(STORAGE.derivAppId, (el('derivAppIdInputOauth').value.trim() || '')));
bind('btnSaveMt5', 'click', saveMt5Mode);
bind('btnMt5Status', 'click', checkMt5Bridge);
bind('btnMt5StatusBroker', 'click', checkMt5Bridge);
bind('mt5ServerInput', 'input', () => { localStorage.setItem(STORAGE.mt5Server, el('mt5ServerInput').value.trim()); updateMt5Ui(); });
bind('mt5LoginInput', 'input', () => { localStorage.setItem(STORAGE.mt5Login, el('mt5LoginInput').value.trim()); updateMt5Ui(); });


window.addEventListener('beforeunload', () => { if (botTimer) clearInterval(botTimer); });

// Captura retorno OAuth caso a Deriv volte para / em vez de /deriv-callback.html.
function captureDerivReturnOnHome() {
  const qp = new URLSearchParams(window.location.search || '');
  const hp = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
  const acct = qp.get('acct1') || hp.get('acct1');
  const token = qp.get('token1') || hp.get('token1');
  if (!acct || !token) return;
  const accounts = [];
  for (let i = 1; i <= 20; i++) {
    const a = qp.get(`acct${i}`) || hp.get(`acct${i}`);
    const t = qp.get(`token${i}`) || hp.get(`token${i}`);
    const c = qp.get(`cur${i}`) || hp.get(`cur${i}`);
    if (a && t) accounts.push({ acct: a, token: t, currency: (c || '').toUpperCase(), mode: /^VRTC/i.test(a) ? 'demo' : 'real' });
  }
  if (!accounts.length) return;
  sessionStorage.setItem(STORAGE.accounts, JSON.stringify(accounts.map(({ acct, currency, mode }) => ({ acct, currency, mode }))));
  sessionStorage.setItem(STORAGE.accountsFull, JSON.stringify(accounts));
  const selected = accounts.find((a) => /^VRTC/i.test(a.acct)) || accounts[0];
  setSelectedAccount(selected);
  sessionStorage.setItem(STORAGE.tokenSource, 'deriv_oauth_login');
  window.history.replaceState({}, '', '/#operacao');
}
captureDerivReturnOnHome();

document.querySelectorAll('.nav-item').forEach((item) => {
  item.addEventListener('click', () => showPage(item.dataset.page || 'dashboard'));
});
document.querySelectorAll('.go-page').forEach((button) => {
  button.addEventListener('click', () => showPage(button.dataset.go || 'dashboard'));
});

function showPage(page) {
  document.querySelectorAll('.nav-item').forEach((i) => i.classList.toggle('active', i.dataset.page === page));
  document.querySelectorAll('.page-section').forEach((s) => s.classList.toggle('active', s.dataset.view === page));
  const meta = PAGE_META[page] || PAGE_META.dashboard;
  if (el('pageEyebrow')) el('pageEyebrow').textContent = meta[0];
  if (el('pageTitle')) el('pageTitle').textContent = meta[1];
  if (el('pageSubtitle')) el('pageSubtitle').textContent = meta[2];
  window.history.replaceState({}, '', `#${page}`);
}

function getAccountsFull() {
  try { return JSON.parse(sessionStorage.getItem(STORAGE.accountsFull) || '[]'); } catch { return []; }
}
function setSelectedAccount(account) {
  if (!account) return;
  sessionStorage.setItem(STORAGE.token, account.token || '');
  sessionStorage.setItem(STORAGE.loginid, account.acct || account.loginid || '');
  sessionStorage.setItem(STORAGE.currency, account.currency || '');
}
function getAccountMode() { return localStorage.getItem(STORAGE.accountMode) || el('accountModeSelect')?.value || 'demo'; }
function getDerivToken() { return sessionStorage.getItem(STORAGE.token) || ''; }
function getDerivTokenSource() { return sessionStorage.getItem(STORAGE.tokenSource) || ''; }
function hasDerivAuth() {
  const source = getDerivTokenSource();
  return Boolean(getDerivToken() || source === 'env_demo_token' || source === 'env_live_token');
}
function getDerivLoginId() { return sessionStorage.getItem(STORAGE.loginid) || ''; }
function getDerivCurrency() { return sessionStorage.getItem(STORAGE.currency) || ''; }
function inferAccountMode(loginid = '') { return /^VRTC/i.test(String(loginid || '')) ? 'demo' : 'real'; }
function getDerivAppId() {
  return (el('derivAppIdInputOauth')?.value || localStorage.getItem(STORAGE.derivAppId) || DEFAULT_DERIV_APP_ID).trim();
}
function humanError(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value.message) return value.message;
  try { return JSON.stringify(value); } catch { return String(value); }
}
function authHeaders(extra = {}) {
  const token = getDerivToken();
  const headers = { ...extra, 'X-Deriv-App-Id': getDerivAppId() };
  return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
}

function restoreFormState() {
  const mode = localStorage.getItem(STORAGE.accountMode) || 'demo';
  if (el('accountModeSelect')) el('accountModeSelect').value = mode;
  if (el('stakeInput')) el('stakeInput').value = localStorage.getItem(STORAGE.stake) || el('stakeInput').value || '1';
  if (el('durationSelect')) el('durationSelect').value = localStorage.getItem(STORAGE.duration) || el('durationSelect').value || '5';
  if (el('derivAppIdInputOauth')) el('derivAppIdInputOauth').value = localStorage.getItem(STORAGE.derivAppId) || '';
  if (el('mt5ServerInput')) el('mt5ServerInput').value = localStorage.getItem(STORAGE.mt5Server) || '';
  if (el('mt5LoginInput')) el('mt5LoginInput').value = localStorage.getItem(STORAGE.mt5Login) || '';
  renderAccountOptions();
  updateDerivLoginStatus();
  updateDashboardSelection();
}

function renderAccountOptions() {
  const select = el('derivAccountSelect');
  if (!select) return;
  const accounts = getAccountsFull();
  const mode = getAccountMode();
  const filtered = accounts.filter((a) => inferAccountMode(a.acct) === mode);
  const current = getDerivLoginId();
  if (!accounts.length) {
    select.innerHTML = '<option value="">Conecte a Deriv</option>';
    updateSelectedAccountHint();
    return;
  }
  if (!filtered.length) {
    select.innerHTML = `<option value="">Nenhuma conta ${mode === 'demo' ? 'demo' : 'real'} retornada</option>`;
    updateSelectedAccountHint();
    return;
  }
  select.innerHTML = filtered.map((a) => `<option value="${escapeHtml(a.acct)}">${escapeHtml(a.acct)} • ${escapeHtml(a.currency || 'USD')} • ${inferAccountMode(a.acct).toUpperCase()}</option>`).join('');
  const validCurrent = filtered.find((a) => a.acct === current);
  const selected = validCurrent || filtered[0];
  select.value = selected.acct;
  setSelectedAccount(selected);
  updateSelectedAccountHint();
}

function onAccountModeChange() {
  const mode = el('accountModeSelect')?.value || 'demo';
  localStorage.setItem(STORAGE.accountMode, mode);
  if (mode === 'real') showToast('Conta real selecionada. A execução real só ocorre se as travas do Netlify também estiverem liberadas.');
  renderAccountOptions();
  updateDerivLoginStatus();
  updateDashboardSelection();
  loadDashboard();
}
function onDerivAccountChange() {
  const acct = el('derivAccountSelect')?.value;
  const account = getAccountsFull().find((a) => a.acct === acct);
  if (account) setSelectedAccount(account);
  updateSelectedAccountHint();
  updateDerivLoginStatus();
  updateDashboardSelection();
  testDeriv();
}
function showConnectMethod(method = 'token') {
  document.querySelectorAll('.connect-tab').forEach((b) => b.classList.toggle('active', b.dataset.connectTab === method));
  document.querySelectorAll('.connect-method').forEach((p) => p.classList.toggle('active', p.dataset.connectPanel === method));
}

function saveMt5Mode() {
  const server = (el('mt5ServerInput')?.value || '').trim();
  const login = (el('mt5LoginInput')?.value || '').trim();
  if (!server || !login) {
    showToast('Informe o servidor e o Login ID do MT5.');
    return;
  }
  localStorage.setItem(STORAGE.brokerMode, 'mt5_bridge');
  localStorage.setItem(STORAGE.mt5Server, server);
  localStorage.setItem(STORAGE.mt5Login, login);
  updateMt5Ui();
  showToast('Modo Deriv MT5 salvo. Instale o EA Bridge no MT5 desktop/VPS para executar ordens.');
}

function updateMt5Ui() {
  const server = localStorage.getItem(STORAGE.mt5Server) || '-';
  const login = localStorage.getItem(STORAGE.mt5Login) || '-';
  if (el('brokerMt5Server')) el('brokerMt5Server').textContent = server;
  if (el('brokerMt5Login')) el('brokerMt5Login').textContent = login;
  const isMt5 = localStorage.getItem(STORAGE.brokerMode) === 'mt5_bridge';
  if (el('metricBroker')) el('metricBroker').textContent = isMt5 ? 'Deriv MT5' : el('metricBroker').textContent;
  if (el('metricBrokerStatus') && isMt5) el('metricBrokerStatus').textContent = 'Bridge configurado';
}

async function checkMt5Bridge() {
  showPage('broker');
  const server = localStorage.getItem(STORAGE.mt5Server) || '';
  const login = localStorage.getItem(STORAGE.mt5Login) || '';
  showOutput('Testando status do Bridge MT5...');
  try {
    const data = await callApi(`/api/mt5-bridge-status?login=${encodeURIComponent(login)}&server=${encodeURIComponent(server)}`);
    const txt = data?.connected ? 'Online' : 'Aguardando EA';
    if (el('brokerMt5Status')) el('brokerMt5Status').textContent = txt;
    showToast(data?.connected ? 'Bridge MT5 online.' : 'Bridge MT5 ainda não reportou heartbeat.');
  } catch (err) {
    if (el('brokerMt5Status')) el('brokerMt5Status').textContent = 'Aguardando EA';
    showToast('Bridge MT5 ainda não conectado.');
  }
}

async function connectWithDerivToken() {
  showPage('operacao');
  const token = (el('derivTokenInput')?.value || '').trim();
  const appId = getDerivAppId();
  localStorage.setItem(STORAGE.derivAppId, appId);
  if (!token) {
    showToast('Cole o token da Deriv antes de conectar.');
    setSetupWarning('Crie um token na Deriv com escopo Read para teste e Trade para operar. Depois cole aqui e clique em Conectar com token.');
    return;
  }
  sessionStorage.setItem(STORAGE.token, token);
  sessionStorage.setItem(STORAGE.tokenSource, 'browser_deriv_token');
  showOutput(`Validando token na Deriv com App ID ${appId}...`);
  let data = await testDeriv();

  // Fallback: se a função Netlify falhar no WebSocket, testa direto no navegador.
  if (!data?.authorized) {
    showOutput('Backend não validou. Tentando validação direta no navegador...');
    const browserData = await testDerivInBrowser(token, appId);
    if (browserData?.authorized) data = browserData;
    else data = data || browserData;
  }

  if (!data?.authorized || !data.loginid) {
    sessionStorage.removeItem(STORAGE.token);
    sessionStorage.removeItem(STORAGE.tokenSource);
    const msg = humanError(data?.error) || data?.hint || 'Token não autorizado pela Deriv. Verifique se copiou corretamente, se possui escopo Read e se o App ID está válido.';
    setSetupWarning(`${msg} | App ID usado: ${appId}`);
    return;
  }
  const account = { acct: data.loginid, token, currency: data.currency || 'USD', mode: inferAccountMode(data.loginid) };
  sessionStorage.setItem(STORAGE.accounts, JSON.stringify([{ acct: account.acct, currency: account.currency, mode: account.mode }]));
  sessionStorage.setItem(STORAGE.accountsFull, JSON.stringify([account]));
  sessionStorage.setItem(STORAGE.loginid, account.acct);
  sessionStorage.setItem(STORAGE.currency, account.currency || '');
  if (el('derivTokenInput')) el('derivTokenInput').value = '';
  localStorage.setItem(STORAGE.accountMode, account.mode);
  if (el('accountModeSelect')) el('accountModeSelect').value = account.mode;
  renderAccountOptions();
  updateDerivLoginStatus();
  updateDashboardSelection();
  setSetupWarning('');
  showToast(`Deriv conectada por token: ${account.acct}`);
}

function updateSelectedAccountHint() {
  const hint = el('selectedAccountHint');
  if (!hint) return;
  const loginid = getDerivLoginId();
  const mode = loginid ? inferAccountMode(loginid) : getAccountMode();
  const currency = getDerivCurrency();
  if (!loginid) {
    hint.textContent = 'Nenhuma conta conectada. Clique em Conectar Deriv.';
    hint.className = 'form-note warn-text';
    return;
  }
  hint.textContent = `Conta ativa: ${loginid} • ${mode.toUpperCase()}${currency ? ` • ${currency}` : ''}`;
  hint.className = mode === 'real' ? 'form-note err-text' : 'form-note ok-text';
}

async function loginWithDeriv() {
  showPage('operacao');
  showOutput('Gerando URL oficial de login da Deriv...');
  sessionStorage.setItem(STORAGE.returnTo, '/#operacao');
  try {
    const appId = (el('derivAppIdInputOauth')?.value || localStorage.getItem(STORAGE.derivAppId) || '').trim();
    const loginUrl = appId ? `/api/deriv-oauth-url?app_id=${encodeURIComponent(appId)}` : '/api/deriv-oauth-url';
    const res = await fetch(loginUrl, { cache: 'no-store' });
    const data = await res.json();
    if (!data.ok || !data.authorize_url) {
      const hint = data.setup_hint || data.error || 'Não foi possível gerar URL de login Deriv.';
      setSetupWarning(hint);
      throw new Error(hint);
    }
    if (data.app_id) localStorage.setItem(STORAGE.derivAppId, String(data.app_id));
    if (data.mode === 'oauth2_pkce') {
      sessionStorage.setItem('df_deriv_oauth_state', data.state || '');
      sessionStorage.setItem('df_deriv_pkce_code_verifier', data.code_verifier || '');
      sessionStorage.setItem('df_deriv_oauth_redirect_uri', data.callback_url || `${window.location.origin}/deriv-callback.html`);
    } else {
      sessionStorage.removeItem('df_deriv_oauth_state');
      sessionStorage.removeItem('df_deriv_pkce_code_verifier');
      if (data.warning) showToast(data.warning);
      sessionStorage.setItem('df_deriv_oauth_app_id', String(data.app_id || appId || ''));
    }
    if (!data.setup_ok && data.setup_hint) setSetupWarning(data.setup_hint);
    showToast('Redirecionando para a tela oficial da Deriv...');
    window.location.href = data.authorize_url;
  } catch (err) {
    showOutput(`Erro no login Deriv: ${err.message}`);
    showToast(`Erro no login Deriv: ${err.message}`);
  }
}
function setSetupWarning(message) {
  const box = el('derivSetupWarning');
  if (!box) return;
  box.textContent = humanError(message) || '';
  box.style.display = message ? 'block' : 'none';
}
function logoutDeriv() {
  for (const key of [STORAGE.token, STORAGE.tokenSource, STORAGE.loginid, STORAGE.currency, STORAGE.accounts, STORAGE.accountsFull]) {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  }
  stopOperations();
  setSetupWarning('');
  showOutput('Login Deriv removido deste navegador.');
  showToast('Conexão Deriv removida.');
  renderAccountOptions();
  updateDerivLoginStatus();
  updateDashboardSelection();
  loadDashboard();
}
async function testDeriv() {
  let data = await callApi('/api/deriv-test');
  if (!data?.authorized && getDerivToken()) {
    const browserData = await testDerivInBrowser(getDerivToken(), getDerivAppId());
    if (browserData?.authorized) {
      data = browserData;
      showOutput(JSON.stringify({ ...browserData, note: 'Validado direto pelo navegador porque a função Netlify falhou.' }, null, 2));
    }
  }
  if (data?.authorized && data.loginid) {
    showToast(`Deriv conectada: ${data.loginid}`);
    sessionStorage.setItem(STORAGE.loginid, data.loginid);
    sessionStorage.setItem(STORAGE.tokenSource, data.token_source || 'env_or_browser');
    if (data.currency) sessionStorage.setItem(STORAGE.currency, data.currency);
    const mode = inferAccountMode(data.loginid);
    localStorage.setItem(STORAGE.accountMode, mode);
    if (el('accountModeSelect')) el('accountModeSelect').value = mode;
    const account = { acct: data.loginid, currency: data.currency || 'USD', mode, token: getDerivToken() };
    sessionStorage.setItem(STORAGE.accounts, JSON.stringify([{ acct: account.acct, currency: account.currency, mode: account.mode }]));
    sessionStorage.setItem(STORAGE.accountsFull, JSON.stringify([account]));
    renderAccountOptions();
    updateDerivLoginStatus();
    updateDashboardSelection();
    setSetupWarning('');
  } else if (data?.error || data?.hint) {
    setSetupWarning(`${humanError(data.error) || data.hint} | App ID usado: ${getDerivAppId()}`);
  }
  return data;
}

async function runScan({ execute = false, source = 'scan' } = {}) {
  const body = buildRunPayload(execute);
  showOutput(`${execute ? 'Executando estratégia' : 'Executando scan'}...`);
  const data = await callApi('/api/bot-run-once', { method: 'POST', body: JSON.stringify({ ...body, source }) });
  await syncOrders({ silent: true });
  await loadDashboard();
  return data;
}
function buildRunPayload(execute) {
  return {
    execute: Boolean(execute),
    accountMode: getAccountMode(),
    selectedLoginId: getDerivLoginId(),
    stake: Number(el('stakeInput')?.value || localStorage.getItem(STORAGE.stake) || 1),
    duration: Number(el('durationSelect')?.value || localStorage.getItem(STORAGE.duration) || 5),
    durationUnit: 'm',
    maxTradesPerRun: 1,
    derivAppId: getDerivAppId()
  };
}
function startOperations() {
  if (!hasDerivAuth()) {
    showToast('Conecte a Deriv antes de iniciar as operações.');
    showPage('operacao');
    return;
  }
  localStorage.setItem(STORAGE.botRunning, 'true');
  setBotRunningUI(true);
  showToast('Operações iniciadas. O painel executará scans a cada 60 segundos enquanto esta aba estiver aberta.');
  runScan({ execute: true, source: 'start_operations' });
  if (botTimer) clearInterval(botTimer);
  botTimer = setInterval(() => runScan({ execute: true, source: 'auto_interval' }), 60000);
}
function stopOperations() {
  localStorage.setItem(STORAGE.botRunning, 'false');
  if (botTimer) clearInterval(botTimer);
  botTimer = null;
  setBotRunningUI(false);
  showToast('Operações pausadas.');
}
function setBotRunningUI(running) {
  const title = el('botControlTitle');
  const text = el('botControlText');
  const status = el('botIntervalStatus');
  if (title) title.textContent = running ? 'Bot rodando' : 'Bot pausado';
  if (text) text.textContent = running ? 'As estratégias estão rodando nesta aba. Mantenha o navegador aberto.' : 'Clique para iniciar os scans automáticos e registrar entradas, resultados, ganhos e perdas.';
  if (status) status.textContent = running ? `Intervalo: 60s • ativo desde ${new Date().toLocaleTimeString('pt-BR')}` : 'Intervalo: 60s • aguardando início';
  if (el('metricBotStatus')) {
    el('metricBotStatus').textContent = running ? 'Rodando' : 'Pausado';
    el('metricBotStatus').className = running ? 'ok-text' : 'warn-text';
  }
  if (el('metricBotSince')) el('metricBotSince').textContent = running ? 'Estratégias ativas nesta aba' : 'Aguardando início';
}
async function syncOrders({ silent = false } = {}) {
  const data = await callApi('/api/deriv-sync-orders', { method: 'POST', body: JSON.stringify({ accountMode: getAccountMode() }) });
  if (!silent) await loadDashboard();
  return data;
}

function derivBrowserRequest(ws, payload, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const reqId = Math.floor(Math.random() * 1e9);
    const timer = setTimeout(() => reject(new Error(`Timeout Deriv API para ${JSON.stringify(payload)}`)), timeoutMs);
    const onMessage = (event) => {
      let data;
      try { data = JSON.parse(event.data); } catch { return; }
      if (data.req_id !== reqId) return;
      clearTimeout(timer);
      ws.removeEventListener('message', onMessage);
      if (data.error) reject(new Error(data.error.message || 'Erro Deriv API'));
      else resolve(data);
    };
    ws.addEventListener('message', onMessage);
    ws.send(JSON.stringify({ ...payload, req_id: reqId }));
  });
}

async function testDerivInBrowser(token, appId = DEFAULT_DERIV_APP_ID) {
  return new Promise((resolve) => {
    const finalAppId = String(appId || DEFAULT_DERIV_APP_ID).trim() || DEFAULT_DERIV_APP_ID;
    const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${encodeURIComponent(finalAppId)}`);
    const timeout = setTimeout(() => {
      try { ws.close(); } catch {}
      resolve({ ok: false, error: `Timeout ao conectar direto na Deriv com App ID ${finalAppId}` });
    }, 15000);
    ws.addEventListener('open', async () => {
      try {
        const ping = await derivBrowserRequest(ws, { ping: 1 });
        const auth = await derivBrowserRequest(ws, { authorize: token }, 15000);
        const balance = await derivBrowserRequest(ws, { balance: 1 }, 15000);
        const activeSymbols = await derivBrowserRequest(ws, { active_symbols: 'brief', product_type: 'basic' }, 20000);
        clearTimeout(timeout);
        try { ws.close(); } catch {}
        resolve({
          ok: true,
          authorized: Boolean(auth?.authorize),
          loginid: auth?.authorize?.loginid || null,
          fullname: auth?.authorize?.fullname || null,
          currency: balance?.balance?.currency || auth?.authorize?.currency || null,
          balance: balance?.balance?.balance || null,
          ping,
          app_id_used: finalAppId,
          token_source: 'browser_direct_websocket',
          sampleSymbols: (activeSymbols.active_symbols || []).slice(0, 12).map((s) => ({ symbol: s.symbol, display_name: s.display_name, market: s.market }))
        });
      } catch (err) {
        clearTimeout(timeout);
        try { ws.close(); } catch {}
        resolve({ ok: false, error: err.message || String(err), app_id_used: finalAppId });
      }
    });
    ws.addEventListener('error', () => {
      clearTimeout(timeout);
      resolve({ ok: false, error: `Falha no WebSocket direto da Deriv. Verifique App ID ${finalAppId}.`, app_id_used: finalAppId });
    });
  });
}

async function callApi(url, options = {}) {
  const method = options.method || 'GET';
  showOutput(`${method} ${url}...`);
  try {
    const headers = authHeaders({ ...(options.headers || {}) });
    if (method !== 'GET' && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    const res = await fetch(url, { cache: 'no-store', ...options, method, headers });
    let data = null;
    const text = await res.text();
    try { data = text ? JSON.parse(text) : {}; } catch { data = { ok: false, error: text || `HTTP ${res.status}` }; }
    showOutput(JSON.stringify(data, null, 2));
    if (!res.ok || data.ok === false) {
      const msg = humanError(data.error) || data.hint || `HTTP ${res.status}`;
      showToast(msg);
    } else {
      showToast('Chamada executada com sucesso.');
    }
    return data;
  } catch (err) {
    showOutput(`Erro: ${err.message}`);
    showToast(`Erro: ${err.message}`);
    return null;
  }
}

async function loadDashboard() {
  updateDerivLoginStatus();
  try {
    const [dashRes, configRes] = await Promise.all([
      fetch('/api/dashboard', { cache: 'no-store', headers: authHeaders() }),
      fetch('/api/config-status', { cache: 'no-store' })
    ]);
    const dash = await dashRes.json();
    const config = await configRes.json();
    lastDashboard = dash;
    lastConfig = config;
    renderTop(dash, config);
    renderCards(dash, config);
    renderSignals(dash.signals || []);
    renderOrders(dash.orders || []);
    renderOrdersPreview(dash.orders || []);
    renderWatchlist(config.symbols || dash.status?.symbols || []);
    renderRisk(dash, config);
    renderPerformance(dash.signals || [], dash.orders || []);
    renderLogs(dash.logs || []);
    if (configBox) configBox.textContent = JSON.stringify(toSafeConfig(config), null, 2);
    if (lastUpdate) lastUpdate.textContent = new Date().toLocaleString('pt-BR');
    updateSupabaseStatus(config);
    updateDerivLoginStatus(config);
    updateDashboardSelection();
    if (el('serverStatus')) el('serverStatus').textContent = 'Online';
  } catch (err) {
    if (configBox) configBox.textContent = `Erro ao carregar dashboard: ${err.message}`;
    if (el('serverStatus')) el('serverStatus').textContent = 'Falha';
    showToast(`Falha ao carregar dashboard: ${err.message}`);
  }
}

function renderTop(dash, config) {
  const status = dash.status || {};
  const selectedMode = getAccountMode();
  const mode = status.mode || config?.safety?.bot_mode || 'dry_run';
  const connected = getDerivLoginId();
  const effectiveMode = connected ? inferAccountMode(connected) : selectedMode;
  setText('modeTitle', `${String(effectiveMode).toUpperCase()} / ${String(mode).toUpperCase()}`);
  setText('metricBroker', status.broker || 'deriv_api');
  setText('metricEquity', calcEquity(dash.orders || []));
  setText('metricPL', calcProfit(dash.orders || []));
  setText('metricDrawdown', `${config?.safety?.execution_blocked ? '0.00' : 'Ativo'}${config?.safety?.execution_blocked ? '%' : ''}`);
  setText('metricRisk', selectedMode === 'real' ? 'Atenção' : 'Seguro');
  setText('marketRegimeTitle', (dash.signals || []).length ? 'Sinais em validação' : 'Aguardando análise');
  setText('marketRegimeText', (dash.signals || []).length ? 'Há sinais salvos no Supabase. Revise score, rejeições e risco antes de operar.' : 'Clique em Scan único ou Iniciar operações para coletar candles e classificar o mercado.');
  const modeDescription = el('modeDescription');
  if (modeDescription) modeDescription.textContent = selectedMode === 'real'
    ? 'Conta real selecionada. Ordem real só será enviada se as travas do Netlify também estiverem liberadas.'
    : 'Conta demo selecionada. Ideal para validar a estratégia antes de qualquer uso real.';
}
function renderCards(dash, config) {
  const status = dash.status || {};
  const signals = dash.signals || [];
  const orders = dash.orders || [];
  const approved = signals.filter((s) => s.approved).length;
  const rejected = Math.max(signals.length - approved, 0);
  const winRate = getWinRate(orders);
  const latestOpen = orders.filter((o) => o.status === 'open').length;
  const cards = [
    ['SINAIS HOJE', String(signals.length), `${approved} aprovados / ${rejected} rejeitados`],
    ['ACERTOS', winRate, orders.length ? `${orders.length} ordens avaliadas` : 'Sem ordens ainda'],
    ['LUCRO LÍQUIDO', calcProfit(orders), 'Resultado registrado'],
    ['FATOR DE LUCRO', calcProfitFactor(orders), 'Meta mínima: 1.30'],
    ['TRADES HOJE', String(orders.length), `${latestOpen} abertos`],
    ['CONTA ATIVA', getDerivLoginId() || 'Não conectado', getAccountMode().toUpperCase()],
    ['EXECUÇÃO', config?.safety?.execution_blocked ? 'Protegida' : 'Liberada', config?.safety?.execution_blocked ? 'Dry-run ou env travado' : 'Execução API liberada'],
    ['STAKE', `$${Number(el('stakeInput')?.value || 1).toFixed(2)}`, `Duração ${el('durationSelect')?.value || 5}m`]
  ];
  const target = el('cards');
  if (target) target.innerHTML = cards.map(([label, value, hint]) => `<div class="card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(hint || '')}</small></div>`).join('');
}
function renderSignals(signals) {
  const tbody = el('signalsBody');
  if (!tbody) return;
  if (!signals.length) {
    tbody.innerHTML = '<tr><td colspan="7">Sem sinais carregados. Clique em <b>Scan único</b> ou <b>Iniciar operações</b> após conectar a Deriv.</td></tr>';
    return;
  }
  tbody.innerHTML = signals.slice(0, 30).map((s) => {
    const ok = s.approved ? 'ok' : 'warn';
    const direction = String(s.direction || '-').toUpperCase();
    const dirClass = direction.includes('SELL') ? 'sell' : direction.includes('BUY') ? 'buy' : '';
    return `<tr><td>${fmtDate(s.created_at)}</td><td>${escapeHtml(formatSymbol(s.symbol || '-'))}</td><td><span class="badge ${dirClass}">${escapeHtml(direction)}</span></td><td>${escapeHtml(s.strategy_name || '-')}</td><td>${escapeHtml(String(s.score ?? '-'))}</td><td><span class="badge ${ok}">${s.approved ? 'APROVADO' : 'REJEITADO'}</span></td><td>${escapeHtml(s.rejection_reason || s.close_reason || '-')}</td></tr>`;
  }).join('');
}
function renderOrders(orders) {
  const tbody = el('ordersBody');
  if (!tbody) return;
  if (!orders.length) {
    tbody.innerHTML = '<tr><td colspan="7">Sem entradas realizadas. Inicie as operações para registrar entradas e resultados.</td></tr>';
    return;
  }
  tbody.innerHTML = orders.slice(0, 50).map(orderRow).join('');
}
function renderOrdersPreview(orders) {
  const tbody = el('ordersPreviewBody');
  if (!tbody) return;
  if (!orders.length) {
    tbody.innerHTML = '<tr><td colspan="5">Nenhuma entrada ainda.</td></tr>';
    return;
  }
  tbody.innerHTML = orders.slice(0, 5).map((o) => {
    const profit = Number(o.profit || 0);
    const status = String(o.status || '').toLowerCase();
    const isOpen = status === 'open' || status === 'pending';
    const isWin = !isOpen && profit >= 0;
    const resultClass = isOpen ? 'warn' : isWin ? 'win' : 'loss';
    const label = isOpen ? 'ABERTA' : isWin ? 'GANHO' : 'PERDA';
    return `<tr><td>${fmtDate(o.created_at)}</td><td>${escapeHtml(formatSymbol(o.symbol || '-'))}</td><td><span class="badge ${String(o.direction).toLowerCase().includes('sell') ? 'sell' : 'buy'}">${escapeHtml(String(o.direction || '-').toUpperCase())}</span></td><td><span class="badge ${resultClass}">${label}</span></td><td class="${isOpen ? 'warn-text' : profit >= 0 ? 'ok-text' : 'err-text'}">${isOpen ? 'Em andamento' : escapeHtml(formatMoney(profit))}</td></tr>`;
  }).join('');
}
function orderRow(o) {
  const profit = Number(o.profit || 0);
  const status = String(o.status || '').toLowerCase();
  const isOpen = status === 'open' || status === 'pending';
  const isWin = !isOpen && profit >= 0;
  const resultClass = isOpen ? 'warn' : isWin ? 'win' : 'loss';
  const label = isOpen ? 'ABERTA' : isWin ? 'GANHO' : 'PERDA';
  return `<tr><td>${fmtDate(o.created_at)}</td><td>${escapeHtml(formatSymbol(o.symbol || '-'))}</td><td><span class="badge ${String(o.direction).toLowerCase().includes('sell') ? 'sell' : 'buy'}">${escapeHtml(String(o.direction || '-').toUpperCase())}</span></td><td>${escapeHtml(String(o.stake ?? o.lot_size ?? '-'))}</td><td>${escapeHtml(status || '-')}</td><td><span class="badge ${resultClass}">${label}</span></td><td class="${isOpen ? 'warn-text' : profit >= 0 ? 'ok-text' : 'err-text'}">${isOpen ? 'Em andamento' : escapeHtml(formatMoney(profit))}</td></tr>`;
}
function renderWatchlist(symbols) {
  const target = el('watchlist');
  if (!target) return;
  const map = new Map(DEFAULT_WATCHLIST.map((w) => [w.symbol, w]));
  const rows = (symbols && symbols.length ? symbols.slice(0, 5).map((symbol, i) => map.get(symbol) || { pair: formatSymbol(symbol), symbol, price: '-', change: i % 2 ? '-0.08%' : '+0.12%', dir: i % 2 ? 'down' : 'up' }) : DEFAULT_WATCHLIST);
  target.innerHTML = rows.map((w) => `<div class="watch-row"><b>${escapeHtml(w.pair)}</b><small>${escapeHtml(w.price)}</small><small class="${w.dir === 'up' ? 'ok-text' : 'err-text'}">${escapeHtml(w.change)}</small><div class="spark ${w.dir === 'down' ? 'red' : ''}"></div></div>`).join('');
}
function renderRisk(dash, config) {
  const status = dash.status || {};
  const maxTrade = status?.risk?.maxRiskPerTradePct ?? '-';
  const maxDaily = status?.risk?.maxDailyLossPct ?? '-';
  setText('riskDD', config?.safety?.execution_blocked ? '0.00%' : 'Monitorado');
  setText('riskTrade', `${maxTrade}%`);
  setText('riskDaily', `${maxDaily}%`);
  if (el('riskDonutLabel')) el('riskDonutLabel').innerHTML = getAccountMode() === 'real' ? 'Atenção<br><small>Real</small>' : 'Baixo<br><small>Demo</small>';
}
function renderPerformance(signals, orders) {
  setText('perfWinRate', getWinRate(orders));
  setText('perfProfitFactor', calcProfitFactor(orders));
  setText('perfPLTotal', calcProfit(orders));
  const buy = (signals || []).filter((s) => String(s.direction || '').toLowerCase().includes('buy')).length;
  const sell = (signals || []).filter((s) => String(s.direction || '').toLowerCase().includes('sell')).length;
  setText('perfBuyCount', buy || '-');
  setText('perfSellCount', sell || '-');
  setText('perfSignalCount', `${(signals || []).length || 0} sinais`);
}

function renderLogs(logs) {
  if (!outputBox || outputBox.textContent !== 'Aguardando ação...') return;
  if (!logs?.length) return;
  outputBox.textContent = logs.slice(0, 8).map((l) => `[${fmtDate(l.created_at)}] ${l.level || 'info'} - ${l.message || '-'}`).join('\n');
}

function updateDerivLoginStatus(config = lastConfig) {
  const loginid = getDerivLoginId();
  const connected = Boolean(loginid && hasDerivAuth());
  const dot = el('dotDeriv');
  const pill = el('derivPill');
  if (dot) dot.className = `dot ${connected ? 'ok' : 'warn'}`;
  if (pill) {
    const innerDot = pill.querySelector('.dot');
    const small = pill.querySelector('small');
    if (innerDot) innerDot.className = `dot ${connected ? 'ok' : 'warn'}`;
    if (small) small.textContent = connected ? `${loginid} conectado` : 'Não conectado';
    pill.classList.toggle('connected', connected);
  }
  const connectCard = el('connectCard');
  const title = el('connectTitle');
  const text = el('connectText');
  const btnText = el('btnDerivLoginText');
  const btn = el('btnDerivLogin');
  if (connectCard) connectCard.classList.toggle('connected', connected);
  if (title) title.textContent = connected ? 'Deriv conectada' : 'Conectar Deriv';
  if (text) text.textContent = connected ? `Sessão ativa na conta ${loginid}. Use Sair/Trocar conta para mudar.` : 'Entre pela tela oficial da Deriv. Ao finalizar, você volta automaticamente para este painel.';
  if (btnText) btnText.textContent = connected ? 'Trocar conta Deriv' : 'Conectar Deriv';
  if (btn) btn.classList.toggle('connected-button', connected);
  if (el('connectSummaryTitle')) el('connectSummaryTitle').textContent = connected ? `Deriv conectada: ${loginid}` : 'Deriv não conectada';
  if (el('connectSummaryText')) el('connectSummaryText').textContent = connected ? 'Conta autorizada. Você pode iniciar pela aba Operação.' : 'Entre com login/senha na tela oficial da Deriv para conectar e iniciar os scans.';
  if (el('btnTopDerivLogin')) el('btnTopDerivLogin').textContent = connected ? 'Ir para Operação' : 'Conectar Deriv';
  updateSelectedAccountHint();
  updateDashboardSelection();
}
function updateSupabaseStatus(config) {
  const ok = Boolean(config?.supabase?.url_configured && config?.supabase?.service_role_configured);
  const dot = el('dotSupabase');
  const pill = el('supabasePill');
  if (dot) dot.className = `dot ${ok ? 'ok' : 'warn'}`;
  if (pill) {
    const innerDot = pill.querySelector('.dot');
    const small = pill.querySelector('small');
    if (innerDot) innerDot.className = `dot ${ok ? 'ok' : 'warn'}`;
    if (small) small.textContent = ok ? 'Conectado' : 'Pendente';
  }
}
function updateDashboardSelection() {
  const loginid = getDerivLoginId();
  setText('dashSelectedAccount', loginid || '-');
  setText('dashAccountMode', getAccountMode().toUpperCase());
  setText('dashStake', `$${Number(el('stakeInput')?.value || localStorage.getItem(STORAGE.stake) || 1).toFixed(2)}`);
  setText('dashDuration', `${el('durationSelect')?.value || localStorage.getItem(STORAGE.duration) || 5}m`);
}
function setText(id, value) { if (el(id)) el(id).textContent = value; }

function getWinRate(orders) {
  const closed = (orders || []).filter((o) => !['open', 'pending'].includes(String(o.status || '').toLowerCase()));
  if (!closed.length) return '-';
  const wins = closed.filter((o) => Number(o.profit || 0) >= 0).length;
  return `${Math.round((wins / closed.length) * 1000) / 10}%`;
}
function calcProfit(orders) {
  const closed = (orders || []).filter((o) => o.status !== 'open');
  const profit = closed.reduce((sum, o) => sum + Number(o.profit || 0), 0);
  if (!orders?.length) return '-';
  return formatMoney(profit);
}
function calcEquity(orders) {
  if (!orders?.length) return '-';
  const base = 10000;
  const profit = orders.filter((o) => o.status !== 'open').reduce((sum, o) => sum + Number(o.profit || 0), 0);
  return formatMoney(base + profit);
}
function calcProfitFactor(orders) {
  const closed = (orders || []).filter((o) => o.status !== 'open');
  if (!closed.length) return '-';
  const grossProfit = closed.reduce((sum, o) => sum + Math.max(Number(o.profit || 0), 0), 0);
  const grossLoss = Math.abs(closed.reduce((sum, o) => sum + Math.min(Number(o.profit || 0), 0), 0));
  if (!grossLoss) return grossProfit ? '∞' : '-';
  return (grossProfit / grossLoss).toFixed(2);
}
function formatMoney(value) {
  if (!Number.isFinite(Number(value))) return '-';
  const n = Number(value);
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(value) {
  if (!value) return '-';
  try { return new Date(value).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }); } catch { return '-'; }
}
function formatSymbol(symbol) {
  return String(symbol || '-').replace(/^frx/i, '').replace('XAUUSD', 'XAU/USD').replace(/([A-Z]{3})([A-Z]{3})/, '$1/$2');
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
}
function toSafeConfig(config) {
  return {
    supabase: config?.supabase || {},
    deriv: {
      app_id_configured: config?.deriv?.app_id_configured,
      legacy_app_id_configured: config?.deriv?.legacy_app_id_configured,
      demo_token_configured: config?.deriv?.demo_token_configured,
      live_token_configured: config?.deriv?.live_token_configured,
      trade_mode: config?.deriv?.trade_mode,
      auth_mode: config?.deriv?.auth?.auth_mode,
      callback_url: config?.deriv?.auth?.callback_url
    },
    safety: config?.safety || {},
    symbols: config?.symbols || []
  };
}
function showOutput(message) { if (outputBox) outputBox.textContent = message; }
function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.remove('show'), 4600);
}

function collectLegacyAccountsFromParams(params) {
  const accounts = [];
  for (let i = 1; i <= 20; i++) {
    const acct = params.get(`acct${i}`);
    const token = params.get(`token${i}`);
    const currency = params.get(`cur${i}`);
    if (acct && token) accounts.push({ acct, token, currency: (currency || '').toUpperCase(), mode: /^VRTC/i.test(acct) ? 'demo' : 'real' });
  }
  return accounts;
}
function captureLegacyDerivReturnOnIndex() {
  const query = new URLSearchParams(window.location.search || '');
  const hash = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
  const accounts = [...collectLegacyAccountsFromParams(query), ...collectLegacyAccountsFromParams(hash)];
  if (!accounts.length) return false;
  sessionStorage.setItem(STORAGE.accounts, JSON.stringify(accounts.map(({ acct, currency, mode }) => ({ acct, currency, mode }))));
  sessionStorage.setItem(STORAGE.accountsFull, JSON.stringify(accounts));
  const demo = accounts.find((a) => /^VRTC/i.test(a.acct));
  const selected = demo || accounts[0];
  sessionStorage.setItem(STORAGE.token, selected.token);
  sessionStorage.setItem(STORAGE.loginid, selected.acct);
  sessionStorage.setItem(STORAGE.currency, selected.currency || '');
  window.history.replaceState({}, document.title, '/#operacao');
  renderAccountOptions();
  updateDerivLoginStatus();
  showToast(`Deriv conectada: ${selected.acct}`);
  showPage('operacao');
  setTimeout(() => testDeriv(), 500);
  return true;
}
function handleCallbackReturnNotice() {
  if (captureLegacyDerivReturnOnIndex()) return;
  const params = new URLSearchParams(window.location.search);
  if (params.get('deriv') === 'connected') {
    showToast('Deriv conectada com sucesso. Você voltou automaticamente ao painel.');
    window.history.replaceState({}, document.title, '/#operacao');
    restoreFormState();
    showPage('operacao');
    setTimeout(() => testDeriv(), 500);
  }
  if (params.get('deriv') === 'error') {
    showToast('Login Deriv cancelado ou não concluído.');
    window.history.replaceState({}, document.title, '/#operacao');
    showPage('operacao');
  }
}

restoreFormState();
handleCallbackReturnNotice();
const startHash = (window.location.hash || '#dashboard').replace('#', '') || 'dashboard';
showPage(PAGE_META[startHash] ? startHash : 'dashboard');
setBotRunningUI(localStorage.getItem(STORAGE.botRunning) === 'true');
loadDashboard();
if (localStorage.getItem(STORAGE.botRunning) === 'true' && hasDerivAuth()) {
  botTimer = setInterval(() => runScan({ execute: true, source: 'auto_interval_restored' }), 60000);
}
