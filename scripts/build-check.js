import fs from 'fs';
const required = ['site/index.html','site/app.js','site/styles.css','netlify/functions/health.js','netlify/functions/dashboard.js','netlify/functions/mt5-bridge-poll.js','netlify/functions/mt5-bridge-report.js','mt5/DF_Forex_Pro_Bridge.mq5'];
let ok = true;
for (const f of required) {
  if (!fs.existsSync(f)) { console.error('Arquivo ausente:', f); ok = false; }
}
if (!ok) process.exit(1);
console.log('DF Forex Pro v3.1 build check OK');
