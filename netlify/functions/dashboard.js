import { json, options } from '../../lib/http.js';
import { getDashboardSnapshot } from '../../lib/mt5Bridge.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return options();
  try {
    const snapshot = await getDashboardSnapshot();
    return json(200, { ok: true, ...snapshot });
  } catch (err) {
    return json(500, { ok: false, error: err.message });
  }
}
