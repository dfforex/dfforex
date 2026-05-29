// Scheduled Function opcional. Ative no Netlify se quiser varrer sinais em intervalo.
// Mantida em dry-run por padrão. Não envia ordem real.
export const config = {
  schedule: '*/30 * * * *'
};

import { handler as runOnce } from './bot-run-once.js';

export async function handler(event, context) {
  return await runOnce(event, context);
}
