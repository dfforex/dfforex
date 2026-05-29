const $ = (id) => document.getElementById(id);
const state = { snapshot: null };

function fmtMoney(v) {
  if (v === null || v === undefined || v === '') return '-';
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}
function fmtDate(v) { return v ? new Date(v).toLocaleString('pt-BR') : '-'; }
function safe(v, fallback='-') { return (v === null || v === undefined || v === '') ? fallback : v; }

async function api(path, opts={}) {
  const res = await fetch('/.netlify/functions/' + path, {
    headers: { 'content-type': 'application/json' }, ...opts
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function setTab(tab) {
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.toggle('active', panel.id === 'tab-' + tab));
}

document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => setTab(btn.dataset.tab)));

function rowEmpty(cols, msg='Sem dados carregados') { return `<tr><td colspan="${cols}" class="muted-cell">${msg}</td></tr>`; }

function renderSnapshot(data) {
  state.snapshot = data;
  const cfg = data.config || {};
  const st = data.bridge_status || {};
  const settings = data.settings || {};
  const online = st.status === 'online' && st.last_seen_at && ((Date.now() - new Date(st.last_seen_at).getTime()) < 180000);

  $('serverStatus').textContent = online ? 'MT5 Online' : 'MT5 Offline';
  $('serverStatus').className = 'pill ' + (online ? 'good' : 'bad');
  $('bridgeStatus').textContent = online ? 'Conectado' : 'Offline';
  $('bridgeSub').textContent = online ? `${safe(st.account_server)} • ${safe(st.account_login)}` : 'Aguardando EA Bridge';
  $('equityKpi').textContent = fmtMoney(st.equity);
  $('balanceKpi').textContent = fmtMoney(st.balance);
  $('positionsKpi').textContent = safe(st.open_positions);
  $('tradeAllowedKpi').textContent = `Trade: ${st.trade_allowed ? 'Liberado' : 'Bloqueado/Não informado'}`;
  $('modeText').textContent = `${(cfg.account_type || 'demo').toUpperCase()} / ${(cfg.bot_mode || 'dry_run').toUpperCase()}`;
  $('modeHint').textContent = st.bot_running ? 'Bot rodando no MetaTrader 5' : 'Bot pausado ou aguardando comando';
  $('riskTrade').textContent = `${safe(cfg.risk?.maxRiskPerTradePct, '0.50')}%`;
  $('dailyLoss').textContent = `${safe(cfg.risk?.maxDailyLossPct, '2')}%`;
  $('monthlyDd').textContent = `${safe(cfg.risk?.maxMonthlyDrawdownPct, '10')}%`;

  $('accountType').value = cfg.account_type || settings.account_type || 'demo';
  $('riskPct').value = settings.risk_per_trade_pct || cfg.risk?.maxRiskPerTradePct || 0.5;
  $('fixedLot').value = settings.fixed_lot || 0.01;
  $('brokerName').value = settings.broker_name || 'Deriv MT5';
  $('accountServer').value = settings.account_server || cfg.mt5_server || 'Deriv-Demo';
  $('accountLogin').value = settings.account_login || cfg.mt5_login || st.account_login || '';

  const signals = data.signals || [];
  const orders = data.orders || [];
  $('signalsMini').innerHTML = signals.slice(0,5).map(s => `<tr><td>${fmtDate(s.created_at)}</td><td>${safe(s.symbol)}</td><td>${safe(s.strategy_name)}</td><td>${safe(s.score)}</td><td>${s.approved ? '<span class="tag ok">Aprovado</span>' : '<span class="tag warn">Rejeitado</span>'}</td></tr>`).join('') || rowEmpty(5);
  $('ordersMini').innerHTML = orders.slice(0,5).map(o => `<tr><td>${fmtDate(o.created_at)}</td><td>${safe(o.symbol)}</td><td><span class="tag ${o.direction === 'sell' ? 'sell' : 'buy'}">${safe(o.direction)}</span></td><td>${safe(o.status)}</td><td class="${Number(o.profit||0)>=0?'positive':'negative'}">${fmtMoney(o.profit)}</td></tr>`).join('') || rowEmpty(5);
  $('signalsTable').innerHTML = signals.map(s => `<tr><td>${fmtDate(s.created_at)}</td><td>${safe(s.symbol)}</td><td>${safe(s.direction)}</td><td>${safe(s.strategy_name)}</td><td>${safe(s.score)}</td><td>${s.approved ? 'Aprovado' : 'Rejeitado'}</td><td>${safe(s.rejection_reason)}</td></tr>`).join('') || rowEmpty(7);
  $('ordersTable').innerHTML = orders.map(o => `<tr><td>${fmtDate(o.created_at)}</td><td>${safe(o.mt5_ticket)}</td><td>${safe(o.symbol)}</td><td>${safe(o.direction)}</td><td>${safe(o.lot_size)}</td><td>${safe(o.status)}</td><td class="${Number(o.profit||0)>=0?'positive':'negative'}">${fmtMoney(o.profit)}</td><td>${safe(o.close_reason)}</td></tr>`).join('') || rowEmpty(8);
  $('logsBox').textContent = (data.logs || []).map(l => `[${fmtDate(l.created_at)}] ${l.level || 'info'}: ${l.message}`).join('\n') || 'Sem logs.';
}

async function loadDashboard() {
  try {
    $('serverStatus').textContent = 'Atualizando...';
    const data = await api('dashboard');
    renderSnapshot(data);
  } catch (err) {
    $('serverStatus').textContent = 'Erro';
    $('serverStatus').className = 'pill bad';
    $('logsBox').textContent = err.message;
  }
}

async function sendCommand(action) {
  try {
    $('commandResult').textContent = 'Enviando comando...';
    const payload = { risk_per_trade_pct: Number($('riskPct').value || 0.5), fixed_lot: Number($('fixedLot').value || 0.01) };
    const result = await api('mt5-command', { method: 'POST', body: JSON.stringify({ action, account_type: $('accountType').value, payload }) });
    $('commandResult').textContent = result.execution_blocked ? `Comando criado, mas execução bloqueada: ${result.block_reasons.join(', ')}` : `Comando ${action} enviado ao MT5 Bridge.`;
    await loadDashboard();
  } catch (err) { $('commandResult').textContent = 'Erro: ' + err.message; }
}

async function saveMt5Settings() {
  try {
    const payload = {
      broker_name: $('brokerName').value,
      account_server: $('accountServer').value,
      account_login: $('accountLogin').value,
      account_type: $('accountType').value,
      risk_per_trade_pct: Number($('riskPct').value || 0.5),
      fixed_lot: Number($('fixedLot').value || 0.01)
    };
    await api('mt5-settings', { method: 'POST', body: JSON.stringify(payload) });
    $('commandResult').textContent = 'Configuração visual salva. A senha deve ser usada apenas no MetaTrader 5.';
    await loadDashboard();
  } catch (err) { alert('Erro ao salvar: ' + err.message); }
}

$('refreshBtn').addEventListener('click', loadDashboard);
$('startBtn').addEventListener('click', () => sendCommand('START_BOT'));
$('pauseBtn').addEventListener('click', () => sendCommand('PAUSE_BOT'));
$('scanBtn').addEventListener('click', () => sendCommand('RUN_SCAN'));
$('closeAllBtn').addEventListener('click', () => confirm('Fechar todas as posições abertas no MT5?') && sendCommand('CLOSE_ALL'));
$('saveMt5Btn').addEventListener('click', saveMt5Settings);

loadDashboard();
setInterval(loadDashboard, 30000);
