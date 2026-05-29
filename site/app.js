const el = (id) => document.getElementById(id);
const outputBox = el('outputBox');
const configBox = el('configBox');
const lastUpdate = el('lastUpdate');
const toast = el('toast');

const STORAGE = {
  token: 'df_deriv_token',
  loginid: 'df_deriv_loginid',
  currency: 'df_deriv_currency',
  accounts: 'df_deriv_accounts',
  accountsFull: 'df_deriv_accounts_full',
  returnTo: 'df_deriv_return_to',
  accountMode: 'df_account_mode',
  botRunning: 'df_bot_running',
  stake: 'df_stake',
  duration: 'df_duration'
};

const DEFAULT_WATCHLIST = [
  { pair: 'EUR/USD', symbol: 'frxEURUSD', price: '1.08854', change: '+0.21%', dir: 'up' },
  { pair: 'GBP/USD', symbol: 'frxGBPUSD', price: '1.27231', change: '-0.12%', dir: 'down' },
  { pair: 'USD/JPY', symbol: 'frxUSDJPY', price: '156.784', change: '+0.34%', dir: 'up' },
  { pair: 'AUD/USD', symbol: 'frxAUDUSD', price: '0.66531', change: '-0.08%', dir: 'down' },
  { pair: 'XAU/USD', symbol: 'frxXAUUSD', price: '2,350.12', change: '+0.47%', dir: 'up' }
];

let botTimer = null;
let lastConfig = null;

function bind(id, event, fn) {
  const node = el(id);
  if (node) node.addEventListener(event, fn);
}

bind('btnRefresh', 'click', loadDashboard);
bind('btnSidebarRefresh', 'click', loadDashboard);
bind('btnHealth', 'click', () => callApi('/api/health'));
bind('btnDeriv', 'click', testDeriv);
bind('btnDerivLogin', 'click', loginWithDeriv);
bind('btnDerivLogout', 'click', logoutDeriv);
bind('btnRun', 'click', () => runScan({ execute: false, source: 'manual_scan' }));
bind('btnQuickRun', 'click', startOperations);
bind('btnStartOperations', 'click', startOperations);
bind('btnPause', 'click', stopOperations);
bind('btnQuickPause', 'click', stopOperations);
bind('btnStopOperations', 'click', stopOperations);
bind('btnSyncOrders', 'click', syncOrders);
bind('btnQuickClose', 'click', () => showSafeNotice('Fechar todas as ordens ainda não foi liberado no painel. Use apenas após validação de demo e função de sell/cancel auditada.'));
bind('btnQuickReport', 'click', () => showSafeNotice('Relatório será gerado após termos histórico suficiente no Supabase.'));
bind('btnTheme', 'click', () => document.body.classList.toggle('light'));
bind('accountModeSelect', 'change', onAccountModeChange);
bind('derivAccountSelect', 'change', onDerivAccountChange);
bind('stakeInput', 'input', () => localStorage.setItem(STORAGE.stake, el('stakeInput').value));
bind('durationSelect', 'change', () => localStorage.setItem(STORAGE.duration, el('durationSelect').value));

window.addEventListener('beforeunload', () => {
  if (botTimer) clearInterval(botTimer);
});

document.querySelectorAll('.nav-item').forEach((item) => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach((i) => i.classList.remove('active'));
    item.classList.add('active');
    const section = item.dataset.section;
    const target = section === 'signals' ? 'signalsPanel' : section === 'orders' ? 'ordersPanel' : section === 'risk' ? 'riskDD' : null;
    if (target && el(target)) el(target).scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
});

document.querySelectorAll('[data-scroll]').forEach((button) => {
  button.addEventListener('click', () => el(button.dataset.scroll)?.scrollIntoView({ behavior: 'smooth' }));
});

function getAccountsFull() {
  try { return JSON.parse(sessionStorage.getItem(STORAGE.accountsFull) || '[]'); } catch { return []; }
}

function setSelectedAccount(account) {
  if (!account) return;
  sessionStorage.setItem(STORAGE.token, account.token || '');
  sessionStorage.setItem(STORAGE.loginid, account.acct || account.loginid || '');
  sessionStorage.setItem(STORAGE.currency, account.currency || '');
}

function getAccountMode() {
  return localStorage.getItem(STORAGE.accountMode) || el('accountModeSelect')?.value || 'demo';
}

function getDerivToken() {
  return sessionStorage.getItem(STORAGE.token) || '';
}

function getDerivLoginId() {
  return sessionStorage.getItem(STORAGE.loginid) || '';
}

function getDerivCurrency() {
  return sessionStorage.getItem(STORAGE.currency) || '';
}

function inferAccountMode(loginid = '') {
  return /^VRTC/i.test(String(loginid || '')) ? 'demo' : 'real';
}

function authHeaders(extra = {}) {
  const token = getDerivToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

function restoreFormState() {
  const mode = localStorage.getItem(STORAGE.accountMode) || 'demo';
  if (el('accountModeSelect')) el('accountModeSelect').value = mode;
  if (el('stakeInput')) el('stakeInput').value = localStorage.getItem(STORAGE.stake) || el('stakeInput').value || '1';
  if (el('durationSelect')) el('durationSelect').value = localStorage.getItem(STORAGE.duration) || el('durationSelect').value || '5';
  renderAccountOptions();
  updateDerivLoginStatus();
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
  if (mode === 'real') {
    showToast('Conta real selecionada. A execução real só ocorre se também estiver liberada nas variáveis do Netlify.');
  }
  renderAccountOptions();
  updateDerivLoginStatus();
  loadDashboard();
}

function onDerivAccountChange() {
  const acct = el('derivAccountSelect')?.value;
  const account = getAccountsFull().find((a) => a.acct === acct);
  if (account) setSelectedAccount(account);
  updateSelectedAccountHint();
  updateDerivLoginStatus();
  testDeriv();
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
  showOutput('Gerando URL oficial de login da Deriv...');
  sessionStorage.setItem(STORAGE.returnTo, `${window.location.pathname}${window.location.search}`);
  try {
    const res = await fetch('/api/deriv-oauth-url', { cache: 'no-store' });
    const data = await res.json();
    if (!data.ok || !data.authorize_url) throw new Error(data.error?.message || data.error || 'Não foi possível gerar URL de login Deriv.');

    if (data.mode === 'oauth2_pkce') {
      sessionStorage.setItem('df_deriv_oauth_state', data.state || '');
      sessionStorage.setItem('df_deriv_pkce_code_verifier', data.code_verifier || '');
      sessionStorage.setItem('df_deriv_oauth_redirect_uri', data.callback_url || `${window.location.origin}/deriv-callback.html`);
    } else {
      sessionStorage.removeItem('df_deriv_oauth_state');
      sessionStorage.removeItem('df_deriv_pkce_code_verifier');
      if (data.warning) showToast(data.warning);
    }

    if (!data.setup_ok && data.setup_hint) {
      showOutput(`${data.warning || 'Atenção na configuração Deriv.'}\n\n${data.setup_hint}\n\nURL de retorno esperada: ${data.callback_url}`);
    }

    showToast('Redirecionando para a tela oficial da Deriv...');
    window.location.href = data.authorize_url;
  } catch (err) {
    showOutput(`Erro no login Deriv: ${err.message}`);
    showToast(`Erro no login Deriv: ${err.message}`);
  }
}

function logoutDeriv() {
  for (const key of [STORAGE.token, STORAGE.loginid, STORAGE.currency, STORAGE.accounts, STORAGE.accountsFull]) {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  }
  stopOperations();
  showOutput('Login Deriv removido deste navegador.');
  showToast('Conexão Deriv removida.');
  renderAccountOptions();
  updateDerivLoginStatus();
  loadDashboard();
}

async function testDeriv() {
  const data = await callApi('/api/deriv-test');
  if (data?.authorized && data.loginid) {
    showToast(`Deriv conectada: ${data.loginid}`);
  }
}

async function runScan({ execute = false, source = 'scan' } = {}) {
  const body = buildRunPayload(execute);
  showOutput(`${execute ? 'Executando estratégia' : 'Executando scan'}...`);
  const data = await callApi('/api/bot-run-once', {
    method: 'POST',
    body: JSON.stringify({ ...body, source })
  });
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
    maxTradesPerRun: 1
  };
}

function canStartOperations() {
  if (!getDerivToken() || !getDerivLoginId()) {
    showToast('Conecte a Deriv antes de iniciar operações.');
    return false;
  }
  const selectedMode = getAccountMode();
  const realMode = inferAccountMode(getDerivLoginId());
  if (selectedMode !== realMode) {
    showToast(`A conta conectada é ${realMode}, mas o painel está em ${selectedMode}.`);
    return false;
  }
  if (selectedMode === 'real') {
    const ok = window.confirm('Você selecionou CONTA REAL. Confirma que deseja iniciar operações nesta conta? As travas do Netlify ainda precisam estar liberadas para enviar ordens reais.');
    if (!ok) return false;
  }
  return true;
}

function startOperations() {
  if (!canStartOperations()) return;
  localStorage.setItem(STORAGE.botRunning, 'true');
  setBotRunningUI(true);
  showToast('Bot iniciado. O painel executará scans automáticos enquanto esta aba estiver aberta.');
  runScan({ execute: true, source: 'start_now' });
  if (botTimer) clearInterval(botTimer);
  botTimer = setInterval(() => runScan({ execute: true, source: 'auto_interval' }), 60000);
}

function stopOperations() {
  localStorage.setItem(STORAGE.botRunning, 'false');
  if (botTimer) clearInterval(botTimer);
  botTimer = null;
  setBotRunningUI(false);
  showToast('Bot pausado. Nenhum novo scan automático será iniciado por esta aba.');
}

function setBotRunningUI(running) {
  const title = el('botControlTitle');
  const text = el('botControlText');
  const status = el('botIntervalStatus');
  if (title) title.textContent = running ? 'Bot rodando' : 'Bot pausado';
  if (text) text.textContent = running ? 'Estratégias ativas: varredura automática, registro de sinais e ordens.' : 'Clique para iniciar os scans automáticos e registrar entradas, resultado, ganho e perda.';
  if (status) status.textContent = running ? `Intervalo: 60s • ativo desde ${new Date().toLocaleTimeString('pt-BR')}` : 'Intervalo: 60s • pausado';
  document.body.classList.toggle('bot-running', Boolean(running));
}

async function syncOrders({ silent = false } = {}) {
  if (!getDerivToken()) {
    if (!silent) showToast('Conecte a Deriv para sincronizar contratos abertos.');
    return null;
  }
  const data = await callApi('/api/deriv-sync-orders', { method: 'POST', body: '{}' });
  if (!silent) await loadDashboard();
  return data;
}

function showSafeNotice(message) {
  showOutput(message);
  showToast(message);
}

function updateDerivLoginStatus() {
  const loginid = getDerivLoginId();
  const currency = getDerivCurrency();
  const mode = loginid ? inferAccountMode(loginid) : getAccountMode();
  const dot = el('dotDeriv');
  const pill = el('derivPill');
  if (dot) dot.className = `dot ${loginid ? 'ok' : 'warn'}`;
  if (pill) {
    const innerDot = pill.querySelector('.dot');
    const small = pill.querySelector('small');
    if (innerDot) innerDot.className = `dot ${loginid ? 'ok' : 'warn'}`;
    if (small) small.textContent = loginid ? `${loginid} • ${mode.toUpperCase()}${currency ? ` / ${currency}` : ''}` : 'Não conectado';
  }
  const brokerStatus = el('metricBrokerStatus');
  if (brokerStatus) brokerStatus.textContent = loginid ? `Conectado: ${loginid}` : 'Aguardando login Deriv';

  const connectCard = el('connectCard');
  const title = el('connectTitle');
  const text = el('connectText');
  const btnText = el('btnDerivLoginText');
  const btn = el('btnDerivLogin');
  if (connectCard) connectCard.classList.toggle('connected', Boolean(loginid));
  if (title) title.textContent = loginid ? 'Deriv conectada' : 'Conectar Deriv';
  if (text) text.textContent = loginid ? `Sessão ativa na conta ${loginid}. Use Sair/Trocar conta para mudar.` : 'Entre pela tela oficial da Deriv. Ao finalizar, você volta automaticamente para este painel.';
  if (btnText) btnText.textContent = loginid ? 'Trocar conta Deriv' : 'Conectar Deriv';
  if (btn) btn.classList.toggle('connected-button', Boolean(loginid));
  updateSelectedAccountHint();
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

async function callApi(url, options = {}) {
  const method = options.method || 'GET';
  showOutput(`${method} ${url}...`);
  try {
    const headers = authHeaders({ ...(options.headers || {}) });
    if (method !== 'GET' && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    const res = await fetch(url, { cache: 'no-store', ...options, method, headers });
    const data = await res.json();
    showOutput(JSON.stringify(data, null, 2));
    if (!res.ok || data.ok === false) showToast(data.error?.message || data.error || 'A chamada retornou alerta.');
    else showToast('Chamada executada com sucesso.');
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
    lastConfig = config;
    renderTop(dash, config);
    renderCards(dash, config);
    renderSignals(dash.signals || []);
    renderOrders(dash.orders || []);
    renderWatchlist(config.symbols || dash.status?.symbols || []);
    renderRisk(dash, config);
    configBox.textContent = JSON.stringify(toSafeConfig(config), null, 2);
    lastUpdate.textContent = new Date().toLocaleString('pt-BR');
    updateSupabaseStatus(config);
    updateDerivLoginStatus();
    el('serverStatus').textContent = 'Online';
  } catch (err) {
    configBox.textContent = `Erro ao carregar dashboard: ${err.message}`;
    el('serverStatus').textContent = 'Falha';
    showToast(`Falha ao carregar dashboard: ${err.message}`);
  }
}

function renderTop(dash, config) {
  const status = dash.status || {};
  const selectedMode = getAccountMode();
  const mode = status.mode || config?.safety?.bot_mode || 'dry_run';
  const connected = getDerivLoginId();
  const effectiveMode = connected ? inferAccountMode(connected) : selectedMode;
  el('modeTitle').textContent = `${String(effectiveMode).toUpperCase()} / ${String(mode).toUpperCase()}`;
  el('metricBroker').textContent = status.broker || 'deriv_api';
  el('metricEquity').textContent = calcEquity(dash.orders || []);
  el('metricPL').textContent = calcProfit(dash.orders || []);
  el('metricDrawdown').textContent = `${config?.safety?.execution_blocked ? '0.00' : 'Ativo'}${config?.safety?.execution_blocked ? '%' : ''}`;
  el('metricRisk').textContent = selectedMode === 'real' ? 'Atenção' : 'Seguro';
  const running = localStorage.getItem(STORAGE.botRunning) === 'true';
  el('metricBotStatus').textContent = running ? 'Rodando' : 'Pausado';
  el('metricBotStatus').className = running ? 'ok-text' : 'warn-text';
  el('metricBotSince').textContent = running ? 'Estratégias ativas nesta aba' : 'Aguardando início';
  el('marketRegimeTitle').textContent = (dash.signals || []).length ? 'Sinais em validação' : 'Aguardando análise';
  el('marketRegimeText').textContent = (dash.signals || []).length ? 'Há sinais salvos no Supabase. Revise score, rejeições e risco antes de operar.' : 'Clique em Scan único ou Iniciar operações para coletar candles e classificar o mercado.';
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
  const winRate = orders.length ? `${Math.round((orders.filter((o) => Number(o.profit || 0) >= 0 && ['closed','dry_run','backtest'].includes(o.status)).length / orders.length) * 1000) / 10}%` : '-';
  const latestOpen = orders.filter((o) => o.status === 'open').length;
  const executionHint = config?.safety?.execution_blocked ? 'Dry-run/seguro se não liberar env' : 'Execução API liberada no ambiente';
  const cards = [
    ['SINAIS HOJE', String(signals.length), `${approved} aprovados / ${rejected} rejeitados`],
    ['ACERTOS', winRate, orders.length ? `${orders.length} ordens avaliadas` : 'Sem ordens ainda'],
    ['LUCRO LÍQUIDO', calcProfit(orders), 'Resultado registrado'],
    ['FATOR DE LUCRO', calcProfitFactor(orders), 'Meta mínima: 1.30'],
    ['TRADES HOJE', String(orders.length), `${latestOpen} abertos`],
    ['CONTA ATIVA', getDerivLoginId() || 'Não conectado', getAccountMode().toUpperCase()],
    ['EXECUÇÃO', config?.safety?.execution_blocked ? 'Protegida' : 'Liberada', executionHint],
    ['STAKE', `$${Number(el('stakeInput')?.value || 1).toFixed(2)}`, `Duração ${el('durationSelect')?.value || 5}m`],
    ['RISCO TRADE', `${status?.risk?.maxRiskPerTradePct ?? config?.risk?.maxRiskPerTradePct ?? '-'}%`, 'Limite por operação'],
    ['PERDA DIA', `${status?.risk?.maxDailyLossPct ?? '-'}%`, 'Trava diária']
  ];
  el('cards').innerHTML = cards.map(([label, value, hint]) => `<div class="card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(hint || '')}</small></div>`).join('');
}

function renderSignals(signals) {
  const tbody = el('signalsBody');
  if (!signals.length) {
    tbody.innerHTML = '<tr><td colspan="6">Sem sinais carregados. Clique em <b>Scan único</b> ou <b>Iniciar operações</b> após conectar a Deriv.</td></tr>';
    return;
  }
  tbody.innerHTML = signals.slice(0, 10).map((s) => {
    const ok = s.approved ? 'ok' : 'warn';
    const direction = String(s.direction || '-').toUpperCase();
    const dirClass = direction.includes('SELL') ? 'sell' : direction.includes('BUY') ? 'buy' : '';
    return `<tr>
      <td>${fmtDate(s.created_at)}</td>
      <td>${escapeHtml(formatSymbol(s.symbol || '-'))}</td>
      <td><span class="badge ${dirClass}">${escapeHtml(direction)}</span></td>
      <td>${escapeHtml(s.strategy_name || '-')}</td>
      <td>${escapeHtml(String(s.score ?? '-'))}</td>
      <td><span class="badge ${ok}">${s.approved ? 'APROVADO' : 'REJEITADO'}</span></td>
    </tr>`;
  }).join('');
}

function renderOrders(orders) {
  const tbody = el('ordersBody');
  if (!orders.length) {
    tbody.innerHTML = '<tr><td colspan="6">Sem entradas realizadas. Inicie as operações para registrar entradas e resultados.</td></tr>';
    return;
  }
  tbody.innerHTML = orders.slice(0, 12).map((o) => {
    const profit = Number(o.profit || 0);
    const status = String(o.status || '').toLowerCase();
    const isOpen = status === 'open' || status === 'pending';
    const isWin = !isOpen && profit >= 0;
    const resultClass = isOpen ? 'warn' : isWin ? 'win' : 'loss';
    const label = isOpen ? 'ABERTA' : isWin ? 'GANHO' : 'PERDA';
    return `<tr>
      <td>${fmtDate(o.created_at)}</td>
      <td>${escapeHtml(formatSymbol(o.symbol || '-'))}</td>
      <td><span class="badge ${String(o.direction).toLowerCase().includes('sell') ? 'sell' : 'buy'}">${escapeHtml(String(o.direction || '-').toUpperCase())}</span></td>
      <td>${escapeHtml(String(o.stake ?? o.lot_size ?? '-'))}</td>
      <td><span class="badge ${resultClass}">${escapeHtml(label)}</span></td>
      <td class="${isOpen ? 'warn-text' : profit >= 0 ? 'ok-text' : 'err-text'}">${isOpen ? 'Em andamento' : escapeHtml(formatMoney(profit))}</td>
    </tr>`;
  }).join('');
}

function renderWatchlist(symbols) {
  const map = new Map(DEFAULT_WATCHLIST.map((w) => [w.symbol, w]));
  const rows = (symbols && symbols.length ? symbols.slice(0, 5).map((symbol, i) => map.get(symbol) || {
    pair: formatSymbol(symbol), symbol, price: '-', change: i % 2 ? '-0.08%' : '+0.12%', dir: i % 2 ? 'down' : 'up'
  }) : DEFAULT_WATCHLIST);
  el('watchlist').innerHTML = rows.map((w) => `<div class="watch-row">
    <b>${escapeHtml(w.pair)}</b>
    <small>${escapeHtml(w.price)}</small>
    <small class="${w.dir === 'up' ? 'ok-text' : 'err-text'}">${escapeHtml(w.change)}</small>
    <div class="spark ${w.dir === 'down' ? 'red' : ''}"></div>
  </div>`).join('');
}

function renderRisk(dash, config) {
  const status = dash.status || {};
  const maxTrade = status?.risk?.maxRiskPerTradePct ?? '-';
  const maxDaily = status?.risk?.maxDailyLossPct ?? '-';
  el('riskDD').textContent = config?.safety?.execution_blocked ? '0.00%' : 'Monitorado';
  el('riskTrade').textContent = `${maxTrade}%`;
  el('riskDaily').textContent = `${maxDaily}%`;
  el('riskDonutLabel').innerHTML = getAccountMode() === 'real' ? 'Atenção<br><small>Real</small>' : 'Baixo<br><small>Demo</small>';
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
  return String(symbol || '-')
    .replace(/^frx/i, '')
    .replace('XAUUSD', 'XAU/USD')
    .replace(/([A-Z]{3})([A-Z]{3})/, '$1/$2');
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
      auth_mode: config?.deriv?.auth?.auth_mode
    },
    safety: config?.safety || {},
    symbols: config?.symbols || []
  };
}

function showOutput(message) {
  if (outputBox) outputBox.textContent = message;
}

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.remove('show'), 4600);
}

function collectLegacyAccountsFromCurrentUrl() {
  const query = new URLSearchParams(window.location.search || '');
  const hash = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
  const accounts = [];
  for (let i = 1; i <= 20; i++) {
    const acct = query.get(`acct${i}`) || hash.get(`acct${i}`);
    const token = query.get(`token${i}`) || hash.get(`token${i}`);
    const currency = query.get(`cur${i}`) || hash.get(`cur${i}`);
    if (acct && token) accounts.push({ acct, token, currency: (currency || '').toUpperCase(), mode: /^VRTC/i.test(acct) ? 'demo' : 'real' });
  }
  return accounts;
}

function captureLegacyDerivReturnOnIndex() {
  const accounts = collectLegacyAccountsFromCurrentUrl();
  if (!accounts.length) return false;
  sessionStorage.setItem(STORAGE.accounts, JSON.stringify(accounts.map(({ acct, currency, mode }) => ({ acct, currency, mode }))));
  sessionStorage.setItem(STORAGE.accountsFull, JSON.stringify(accounts));
  const demo = accounts.find((a) => /^VRTC/i.test(a.acct));
  const selected = demo || accounts[0];
  sessionStorage.setItem(STORAGE.token, selected.token);
  sessionStorage.setItem(STORAGE.loginid, selected.acct);
  sessionStorage.setItem(STORAGE.currency, selected.currency || '');
  window.history.replaceState({}, document.title, window.location.pathname);
  renderAccountOptions();
  updateDerivLoginStatus();
  showToast(`Deriv conectada: ${selected.acct}`);
  setTimeout(() => testDeriv(), 500);
  return true;
}

function handleCallbackReturnNotice() {
  if (captureLegacyDerivReturnOnIndex()) return;
  const params = new URLSearchParams(window.location.search);
  if (params.get('deriv') === 'connected') {
    showToast('Deriv conectada com sucesso. Você voltou automaticamente ao painel.');
    const clean = window.location.pathname;
    window.history.replaceState({}, document.title, clean);
    restoreFormState();
    setTimeout(() => testDeriv(), 500);
  }
  if (params.get('deriv') === 'error') {
    showToast('Login Deriv cancelado ou não concluído.');
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

restoreFormState();
handleCallbackReturnNotice();
setBotRunningUI(localStorage.getItem(STORAGE.botRunning) === 'true');
loadDashboard();

if (localStorage.getItem(STORAGE.botRunning) === 'true' && getDerivToken()) {
  botTimer = setInterval(() => runScan({ execute: true, source: 'auto_interval_restored' }), 60000);
}
