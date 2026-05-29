import { json, safeError } from '../../lib/http.js';
import { testDerivConnection } from '../../lib/derivClient.js';
import { getRequestDerivToken, maskToken } from '../../lib/derivAuth.js';

export async function handler(event) {
  try {
    const tokenInfo = getRequestDerivToken(event);
    const result = await testDerivConnection(tokenInfo.token);
    return json(200, {
      ...result,
      token_source: tokenInfo.source,
      token_mask: maskToken(tokenInfo.token)
    });
  } catch (err) {
    return json(500, { ok: false, error: safeError(err) });
  }
}
