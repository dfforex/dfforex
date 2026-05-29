import fs from 'node:fs';

const required = [
  'site/index.html',
  'site/app.js',
  'site/styles.css',
  'netlify/functions/health.js',
  'netlify/functions/dashboard.js',
  'lib/riskEngine.js',
  'lib/strategyTrendPullback.js'
];

let ok = true;
for (const file of required) {
  if (!fs.existsSync(file)) {
    console.error(`[ERRO] Arquivo obrigatório ausente: ${file}`);
    ok = false;
  }
}
if (!ok) process.exit(1);
console.log('DF Forex Pro build check OK.');
