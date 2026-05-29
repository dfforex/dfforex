import WebSocket from 'ws';
import { getConfig } from './config.js';

function wsRequest(ws, payload, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const reqId = Math.floor(Math.random() * 1e9);
    const message = { ...payload, req_id: reqId };
    const timer = setTimeout(() => reject(new Error(`Timeout Deriv API para ${JSON.stringify(payload)}`)), timeoutMs);
    const onMessage = (raw) => {
      let data;
      try { data = JSON.parse(raw.toString()); } catch { return; }
      if (data.req_id !== reqId) return;
      clearTimeout(timer);
      ws.off('message', onMessage);
      if (data.error) reject(new Error(data.error.message || 'Erro Deriv API'));
      else resolve(data);
    };
    ws.on('message', onMessage);
    ws.send(JSON.stringify(message));
  });
}

export async function withDeriv(fn) {
  const cfg = getConfig();
  const appId = cfg.deriv.appId || cfg.deriv.legacyAppId || '1089';
  const url = `wss://ws.derivws.com/websockets/v3?app_id=${encodeURIComponent(appId)}`;
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout ao conectar Deriv WebSocket')), 12000);
    ws.once('open', () => { clearTimeout(timer); resolve(); });
    ws.once('error', reject);
  });
  try {
    return await fn({ request: (payload, timeoutMs) => wsRequest(ws, payload, timeoutMs), ws, cfg });
  } finally {
    try { ws.close(); } catch {}
  }
}

export async function authorizeIfToken(client, token) {
  if (!token) return null;
  return await client.request({ authorize: token });
}

export async function getCandles(symbol, granularitySeconds = 3600, count = 240) {
  return await withDeriv(async (client) => {
    const response = await client.request({
      ticks_history: symbol,
      adjust_start_time: 1,
      count,
      end: 'latest',
      style: 'candles',
      granularity: granularitySeconds
    });
    return response.candles || [];
  });
}

export async function testDerivConnection(tokenOverride = '') {
  return await withDeriv(async (client) => {
    const cfg = client.cfg;
    const token = tokenOverride || (cfg.accountType === 'real' ? cfg.deriv.tokenLive : cfg.deriv.tokenDemo);
    const ping = await client.request({ ping: 1 });
    let auth = null;
    let balance = null;
    if (token) {
      auth = await authorizeIfToken(client, token);
      balance = await client.request({ balance: 1 });
    }
    const activeSymbols = await client.request({ active_symbols: 'brief', product_type: 'basic' }, 20000);
    return {
      ok: true,
      ping,
      authorized: Boolean(auth?.authorize),
      loginid: auth?.authorize?.loginid || null,
      fullname: auth?.authorize?.fullname || null,
      currency: balance?.balance?.currency || auth?.authorize?.currency || null,
      balance: balance?.balance?.balance || null,
      sampleSymbols: (activeSymbols.active_symbols || []).slice(0, 12).map((s) => ({ symbol: s.symbol, display_name: s.display_name, market: s.market }))
    };
  });
}
