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
  returnTo: 'df_deriv_return_to'
};

const DEFAULT_WATCHLIST = [
  { pair: 'EUR/USD', symbol: 'frxEURUSD', price: '1.08854', change: '+0.21%', dir: 'up' },
  { pair: 'GBP/USD', symbol: 'frxGBPUSD', price: '1.27231', change: '-0.12%', dir: 'down' },
  { pair: 'USD/JPY', symbol: 'frxUSDJPY', price: '156.784', change: '+0.34%', dir: 'up' },
  { pair: 'AUD/USD', symbol: 'frxAUDUSD', price: '0.66531', change: '-0.08%', dir: 'down' },
  { pair: 'XAU/USD', symbol: 'frxXAUUSD', price: '2,350.12', change: '+0.47%', dir: 'up' }
];

function bind(id, event, fn) {
  const node = el(id);
  if (node) node.addEventListener(event, fn);
}

bind('btnRefresh', 'click', loadDashboard);
bind('btnSidebarRefresh', 'click', loadDashboard);
bind('btnHealth', 'click', () => callApi('/api/health'));
bind('btnDeriv', 'click', () => callApi('/api/deriv-test'));
bind('btnDerivLogin', 'click', loginWithDeriv);
bind('btnDerivLogout', 'click', logoutDeriv);
bind('btnRun', 'click', runScan);
bind('btnQuickRun', 'click', runScan);
bind('btnPause', 'click', pauseBot);
bind('btnQuickPause', 'click', pauseBot);
bind('btnQuickClose', 'click', () => showSafeNotice('Fechar todas as ordens está bloqueado nesta versão segura/dry-run.'));
bind('btnQuickReport', 'click', () => showSafeNotice('Relatório será gerado após termos histórico suficiente no Supabase.'));
bind('btnTheme', 'click', () => document.body.classList.toggle('light'));

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

function getDerivToken() {
  return sessionStorage.getItem(STORAGE.token) || localStorage.getItem(STORAGE.token) || '';
}

function getDerivLoginId() {
  return sessionStorage.getItem(STORAGE.loginid) || localStorage.getItem(STORAGE.loginid) || '';
}

function getDerivCurrency() {
  return sessionStorage.getItem(STORAGE.currency) || localStorage.getItem(STORAGE.currency) || '';
}

function authHeaders() {
  const token = getDerivToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function loginWithDeriv() {
  showOutput('Gerando URL oficial de login da Deriv...');
  sessionStorage.setItem(STORAGE.returnTo, `${window.location.pathname}${window.location.search}`);
  try {
    const res = await fetch('/api/deriv-oauth-url', { cache: 'no-store' });
    const data = await res.json();
    if (!data.ok || !data.authorize_url) throw new Error(data.error || 'Não foi possível gerar URL de login Deriv.');
    showToast('Redirecionando para a tela oficial da Deriv...');
    window.location.href = data.authorize_url;
  } catch (err) {
    showOutput(`Erro no login Deriv: ${err.message}`);
    showToast(`Erro no login Deriv: ${err.message}`);
  }
}

function logoutDeriv() {
  for (const key of Object.values(STORAGE)) {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  }
  showOutput('Login Deriv removido deste navegador.');
  showToast('Conexão Deriv removida.');
  updateDerivLoginStatus();
  loadDashboard();
}

async function runScan() {
  await callApi('/api/bot-run-once');
  await loadDashboard();
}

function pauseBot() {
  showSafeNotice('Pausa registrada no painel. Como a execução real está bloqueada, nenhuma ordem será enviada.');
}

function showSafeNotice(message) {
  showOutput(message);
  showToast(message);
}

function updateDerivLoginStatus() {
  const loginid = getDerivLoginId();
  const currency = getDerivCurrency();
  const dot = el('dotDeriv');
  const pill = el('derivPill');
  if (dot) dot.className = `dot ${loginid ? 'ok' : 'warn'}`;
  if (pill) {
    const innerDot = pill.querySelector('.dot');
    const small = pill.querySelector('small');
    if (innerDot) innerDot.className = `dot ${loginid ? 'ok' : 'warn'}`;
    if (small) small.textContent = loginid ? `${loginid}${currency ? ` / ${currency}` : ''}` : 'Não conectado';
  }
  const brokerStatus = el('metricBrokerStatus');
  if (brokerStatus) brokerStatus.textContent = loginid ? 'Login OAuth conectado' : 'Aguardando login Deriv';
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

async function callApi(url) {
  showOutput(`Chamando ${url}...`);
  try {
    const res = await fetch(url, { cache: 'no-store', headers: authHeaders() });
    const data = await res.json();
    showOutput(JSON.stringify(data, null, 2));
    if (!res.ok || data.ok === false) showToast(data.error || 'A chamada retornou alerta.');
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
  const accountType = status.account_type || config?.safety?.account_type || '-';
  const mode = status.mode || config?.safety?.bot_mode || '-';
  el('modeTitle').textContent = `${String(accountType).toUpperCase()} / ${String(mode).toUpperCase()}`;
  el('metricBroker').textContent = status.broker || 'deriv_api';
  el('metricEquity').textContent = calcEquity(dash.orders || []);
  el('metricPL').textContent = calcProfit(dash.orders || []);
  el('metricDrawdown').textContent = `${config?.safety?.execution_blocked ? '0.00' : '0.00'}%`;
  el('metricRisk').textContent = config?.safety?.execution_blocked ? 'Seguro' : 'Atenção';
  el('metricBotStatus').textContent = config?.safety?.execution_blocked ? 'Protegido' : 'Liberado';
  el('metricBotStatus').className = config?.safety?.execution_blocked ? 'ok-text' : 'warn-text';
  el('metricBotSince').textContent = config?.safety?.execution_blocked ? 'Execução bloqueada' : 'Execução habilitada';
  el('marketRegimeTitle').textContent = (dash.signals || []).length ? 'Sinais em validação' : 'Aguardando análise';
  el('marketRegimeText').textContent = (dash.signals || []).length ? 'Há sinais salvos no Supabase. Revise score, rejeições e risco antes de operar.' : 'Clique em Run Scan para coletar candles e classificar o mercado.';
}

function renderCards(dash, config) {
  const status = dash.status || {};
  const signals = dash.signals || [];
  const orders = dash.orders || [];
  const approved = signals.filter((s) => s.approved).length;
  const rejected = Math.max(signals.length - approved, 0);
  const winRate = orders.length ? `${Math.round((orders.filter((o) => Number(o.profit || 0) >= 0).length / orders.length) * 1000) / 10}%` : '-';
  const cards = [
    ['SINAIS HOJE', String(signals.length), `${approved} aprovados / ${rejected} rejeitados`],
    ['ACERTOS', winRate, orders.length ? `${orders.length} ordens avaliadas` : 'Sem ordens ainda'],
    ['LUCRO LÍQUIDO', calcProfit(orders), 'Resultado registrado'],
    ['FATOR DE LUCRO', calcProfitFactor(orders), 'Meta mínima: 1.30'],
    ['TRADES HOJE', String(orders.length), config?.safety?.execution_blocked ? 'Dry-run protegido' : 'Execução liberada'],
    ['SUPABASE', config?.supabase?.service_role_configured ? 'Conectado' : 'Pendente', config?.supabase?.url_configured ? 'URL configurada' : 'Configure no Netlify'],
    ['DERIV LOGIN', getDerivLoginId() || 'Não conectado', getDerivCurrency() || 'OAuth oficial'],
    ['EXECUÇÃO', config?.safety?.execution_blocked ? 'Bloqueada' : 'Liberada', (config?.safety?.block_reasons || []).slice(0, 1).join(', ') || 'Sem bloqueios'],
    ['RISCO TRADE', `${status?.risk?.maxRiskPerTradePct ?? config?.safety?.maxRiskPerTradePct ?? config?.risk?.maxRiskPerTradePct ?? '-'}%`, 'Limite por operação'],
    ['PERDA DIA', `${status?.risk?.maxDailyLossPct ?? '-'}%`, 'Trava diária']
  ];
  el('cards').innerHTML = cards.map(([label, value, hint]) => `<div class="card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(hint || '')}</small></div>`).join('');
}

function renderSignals(signals) {
  const tbody = el('signalsBody');
  if (!signals.length) {
    tbody.innerHTML = '<tr><td colspan="6">Sem sinais carregados. Clique em <b>Run Scan</b> após configurar Deriv e Supabase.</td></tr>';
    return;
  }
  tbody.innerHTML = signals.slice(0, 8).map((s) => {
    const ok = s.approved ? 'ok' : 'warn';
    const direction = String(s.direction || '-').toUpperCase();
    const dirClass = direction.includes('SELL') ? 'sell' : direction.includes('BUY') ? 'buy' : '';
    return `<tr>
      <td>${fmtDate(s.created_at)}</td>
      <td>${escapeHtml(formatSymbol(s.symbol || '-'))}</td>
      <td><span class="badge ${dirClass}">${escapeHtml(direction)}</span></td>
      <td>${escapeHtml(s.strategy_name || '-')}</td>
      <td>${escapeHtml(String(s.score ?? '-'))}</td>
      <td><span class="badge ${ok}">${s.approved ? 'EXECUTÁVEL' : 'REJEITADO'}</span></td>
    </tr>`;
  }).join('');
}

function renderOrders(orders) {
  const tbody = el('ordersBody');
  if (!orders.length) {
    tbody.innerHTML = '<tr><td colspan="6">Sem ordens registradas. A versão atual permanece em modo seguro/dry-run.</td></tr>';
    return;
  }
  tbody.innerHTML = orders.slice(0, 8).map((o) => {
    const profit = Number(o.profit || 0);
    const resultClass = profit >= 0 ? 'win' : 'loss';
    return `<tr>
      <td>${fmtDate(o.created_at)}</td>
      <td>${escapeHtml(formatSymbol(o.symbol || '-'))}</td>
      <td><span class="badge ${String(o.direction).toLowerCase().includes('sell') ? 'sell' : 'buy'}">${escapeHtml(String(o.direction || '-').toUpperCase())}</span></td>
      <td>${escapeHtml(String(o.lot_size ?? '-'))}</td>
      <td><span class="badge ${resultClass}">${escapeHtml(o.status || (profit >= 0 ? 'WIN' : 'LOSS'))}</span></td>
      <td class="${profit >= 0 ? 'ok-text' : 'err-text'}">${escapeHtml(formatMoney(profit))}</td>
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
  el('riskDD').textContent = config?.safety?.execution_blocked ? '0.00%' : '-';
  el('riskTrade').textContent = `${maxTrade}%`;
  el('riskDaily').textContent = `${maxDaily}%`;
  el('riskDonutLabel').innerHTML = config?.safety?.execution_blocked ? 'Baixo<br><small>Risco</small>' : 'Atenção<br><small>Risco</small>';
}

function calcProfit(orders) {
  const profit = (orders || []).reduce((sum, o) => sum + Number(o.profit || 0), 0);
  if (!orders?.length) return '-';
  return formatMoney(profit);
}

function calcEquity(orders) {
  if (!orders?.length) return '-';
  const base = 10000;
  const profit = orders.reduce((sum, o) => sum + Number(o.profit || 0), 0);
  return formatMoney(base + profit);
}

function calcProfitFactor(orders) {
  if (!orders?.length) return '-';
  const grossProfit = orders.reduce((sum, o) => sum + Math.max(Number(o.profit || 0), 0), 0);
  const grossLoss = Math.abs(orders.reduce((sum, o) => sum + Math.min(Number(o.profit || 0), 0), 0));
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
  showToast._timer = setTimeout(() => toast.classList.remove('show'), 4200);
}

function handleCallbackReturnNotice() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('deriv') === 'connected') {
    showToast('Deriv conectada com sucesso. Você voltou automaticamente ao painel.');
    const clean = window.location.pathname;
    window.history.replaceState({}, document.title, clean);
    setTimeout(() => callApi('/api/deriv-test'), 600);
  }
  if (params.get('deriv') === 'error') {
    showToast('Login Deriv cancelado ou não concluído.');
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

handleCallbackReturnNotice();
loadDashboard();
