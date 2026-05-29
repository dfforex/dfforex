import { json, safeError } from '../../lib/http.js';
import { testDerivConnection } from '../../lib/derivClient.js';
import { getRequestDerivToken, getRequestDerivAppId, maskToken } from '../../lib/derivAuth.js';

export async function handler(event) {
  try {
    const tokenInfo = getRequestDerivToken(event);
    const derivAppId = getRequestDerivAppId(event);
    const result = await testDerivConnection(tokenInfo.token, derivAppId);
    return json(200, {
      ...result,
      token_source: tokenInfo.source,
      token_mask: maskToken(tokenInfo.token),
      app_id_used: derivAppId
    });
  } catch (err) {
    return json(502, { ok: false, error: safeError(err), hint: 'Falha ao conectar na Deriv. Verifique se o App ID Deriv é válido. Para token/PAT, use App ID 1089 ou o App ID do seu aplicativo Deriv.' });
  }
}
