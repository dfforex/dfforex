# DF Forex Pro v2.2 — Netlify + Supabase + Deriv Login

Versão sem Python local, feita para GitHub + Netlify.

## Novidades da v2.2

- Painel redesenhado com layout premium, sidebar, métricas, watchlist, risco e tabelas.
- Logo DF aplicada no app e no favicon.
- O Supabase continua somente no backend/Netlify Functions; o painel não pede chave.
- Login Deriv via tela oficial da Deriv.
- Depois do login, a Deriv retorna para `/deriv-callback.html` e o app volta automaticamente ao painel com `?deriv=connected`.
- Execução real permanece bloqueada por padrão.

## Website URL da Deriv

No app/API da Deriv, configure o Website URL como:

```text
https://delicate-longma-e8f8d2.netlify.app/deriv-callback.html
```

Para teste local com Netlify Dev:

```text
http://localhost:8787/deriv-callback.html
```

## Variáveis no Netlify

Configure em Site configuration > Environment variables:

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...

PUBLIC_SITE_URL=https://delicate-longma-e8f8d2.netlify.app
DERIV_AUTH_MODE=legacy_oauth_or_pat
DERIV_APP_ID=SEU_APP_ID_DERIV
DERIV_LEGACY_APP_ID=SEU_APP_ID_DERIV

BOT_MODE=dry_run
ACCOUNT_TYPE=demo
ENABLE_ORDER_EXECUTION=false
ALLOW_LIVE_TRADING=false
DERIV_ENABLE_ORDER_EXECUTION=false
DERIV_TRADE_MODE=data_only
FOREX_SYMBOLS=frxEURUSD,frxGBPUSD,frxUSDJPY,frxAUDUSD
```

Nunca suba `.env` para o GitHub.

## Deploy

```bash
npm install
npm run build
```

No Netlify:

```text
Build command: npm run build
Publish directory: site
```
