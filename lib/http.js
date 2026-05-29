export function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type,authorization,x-bridge-secret,x-bridge-id',
      ...extraHeaders
    },
    body: JSON.stringify(body)
  };
}

export function text(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'access-control-allow-origin': '*',
      ...extraHeaders
    },
    body
  };
}

export function options() {
  return { statusCode: 204, headers: {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization,x-bridge-secret,x-bridge-id'
  }, body: '' };
}

export function parseBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'sim', 's', 'on'].includes(String(value).trim().toLowerCase());
}

export function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function safeJsonParse(input, fallback = {}) {
  try { return JSON.parse(input || '{}'); } catch { return fallback; }
}

export function nowIso() { return new Date().toISOString(); }
