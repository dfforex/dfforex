import { json, safeError } from '../../lib/http.js';
import { testDerivConnection } from '../../lib/derivClient.js';

export async function handler() {
  try {
    const result = await testDerivConnection();
    return json(200, result);
  } catch (err) {
    return json(500, { ok: false, error: safeError(err) });
  }
}
