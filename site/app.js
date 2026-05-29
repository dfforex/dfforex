const el = (id) => document.getElementById(id);
const outputBox = el('outputBox');
const configBox = el('configBox');
const lastUpdate = el('lastUpdate');

el('btnRefresh').addEventListener('click', loadDashboard);
el('btnHealth').addEventListener('click', () => callApi('/api/health'));
el('btnDeriv').addEventListener('click', () => callApi('/api/deriv-test'));
el('btnRun').addEventListener('click', async () => {
  await callApi('/api/bot-run-once');
  await loadDashboard();
});

async function callApi(url) {
  outputBox.textContent = `Chamando ${url}...`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();
    outputBox.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    outputBox.textContent = `Erro: ${err.message}`;
  }
}

async function loadDashboard() {
  try {
    const [dashRes, configRes] = await Promise.all([
      fetch('/api/dashboard', { cache: 'no-store' }),
      fetch('/api/config-status', { cache: 'no-store' })
    ]);
    const dash = await dashRes.json();
    const config = await configRes.json();
    renderCards(dash, config);
    renderSignals(dash.signals || []);
    renderOrders(dash.orders || []);
    configBox.textContent = JSON.stringify(config, null, 2);
    lastUpdate.textContent = new Date().toLocaleString('pt-BR');
  } catch (err) {
    configBox.textContent = `Erro ao carregar dashboard: ${err.message}`;
  }
}

function renderCards(dash, config) {
  const status = dash.status || {};
  const cards = [
    ['STATUS', `${status.account_type || '-'} / ${status.mode || '-'}`],
    ['BROKER', status.broker || '-'],
    ['SUPABASE', config?.supabase?.service_role_configured ? 'Configurado' : 'Pendente'],
    ['DERIV', config?.deriv?.demo_token_configured || config?.deriv?.live_token_configured ? 'Configurado' : 'Pendente'],
    ['EXECUÇÃO', config?.safety?.execution_blocked ? 'Bloqueada' : 'Liberada'],
    ['SINAIS', String((dash.signals || []).length)],
    ['ORDENS', String((dash.orders || []).length)],
    ['RISCO TRADE', `${status?.risk?.maxRiskPerTradePct ?? '-'}%`],
    ['PERDA DIA', `${status?.risk?.maxDailyLossPct ?? '-'}%`],
    ['FONTE', dash.source || '-']
  ];
  el('cards').innerHTML = cards.map(([label, value]) => `<div class="card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
}

function renderSignals(signals) {
  const tbody = el('signalsBody');
  if (!signals.length) {
    tbody.innerHTML = '<tr><td colspan="7">Sem sinais carregados. Clique em “Rodar análise dry-run” após configurar Deriv/Supabase.</td></tr>';
    return;
  }
  tbody.innerHTML = signals.map((s) => {
    const ok = s.approved ? 'ok' : 'warn';
    return `<tr>
      <td>${fmtDate(s.created_at)}</td>
      <td>${escapeHtml(s.symbol || '-')}</td>
      <td>${escapeHtml(s.strategy_name || '-')}</td>
      <td>${escapeHtml(s.direction || '-')}</td>
      <td>${escapeHtml(String(s.score ?? '-'))}</td>
      <td><span class="badge ${ok}">${s.approved ? 'APROVADO' : 'REJEITADO'}</span></td>
      <td>${escapeHtml(s.rejection_reason || '-')}</td>
    </tr>`;
  }).join('');
}

function renderOrders(orders) {
  const tbody = el('ordersBody');
  if (!orders.length) {
    tbody.innerHTML = '<tr><td colspan="7">Sem ordens registradas. A versão inicial opera em modo seguro/dry-run.</td></tr>';
    return;
  }
  tbody.innerHTML = orders.map((o) => `<tr>
      <td>${fmtDate(o.created_at)}</td>
      <td>${escapeHtml(o.symbol || '-')}</td>
      <td>${escapeHtml(o.direction || '-')}</td>
      <td>${escapeHtml(String(o.lot_size ?? '-'))}</td>
      <td>${escapeHtml(o.status || '-')}</td>
      <td>${escapeHtml(String(o.profit ?? '-'))}</td>
      <td>${escapeHtml(o.close_reason || '-')}</td>
    </tr>`).join('');
}

function fmtDate(value) {
  if (!value) return '-';
  try { return new Date(value).toLocaleString('pt-BR'); } catch { return '-'; }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
}

loadDashboard();
