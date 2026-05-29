# DF Forex Pro v2.3 — Netlify + Deriv + Supabase

Painel operacional para automação Forex/Deriv com:

- layout premium;
- login oficial Deriv com retorno automático para o painel;
- seleção de Conta Demo ou Conta Real;
- seleção da conta Deriv retornada no OAuth;
- botão **Iniciar operações**;
- execução de scans automáticos enquanto a aba está aberta;
- registro de sinais e entradas no Supabase;
- sincronização de contratos abertos para mostrar ganho/perda;
- travas de segurança para impedir operação real acidental.

## Site

Configure no app/API da Deriv o Website URL:

```text
https://df-forex.netlify.app/deriv-callback.html
```

## Deploy Netlify

```text
Build command: npm run build
Publish directory: site
Functions directory: netlify/functions
```

## Variáveis obrigatórias

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
PUBLIC_SITE_URL=https://df-forex.netlify.app
DERIV_APP_ID=
DERIV_LEGACY_APP_ID=
```

## Modo seguro padrão

```env
BOT_MODE=dry_run
ACCOUNT_TYPE=demo
ENABLE_ORDER_EXECUTION=false
DERIV_ENABLE_ORDER_EXECUTION=false
ALLOW_LIVE_TRADING=false
```

## Operação demo pela Deriv API

Para enviar ordens na conta demo, ajuste no Netlify:

```env
BOT_MODE=live
ACCOUNT_TYPE=demo
ENABLE_ORDER_EXECUTION=true
DERIV_ENABLE_ORDER_EXECUTION=true
ALLOW_LIVE_TRADING=false
DERIV_DEFAULT_STAKE=1
DERIV_CONTRACT_DURATION=5
DERIV_CONTRACT_DURATION_UNIT=m
MAX_TRADES_PER_RUN=1
```

## Operação real

Somente após validar em demo. Requer:

```env
BOT_MODE=live
ACCOUNT_TYPE=real
ENABLE_ORDER_EXECUTION=true
DERIV_ENABLE_ORDER_EXECUTION=true
ALLOW_LIVE_TRADING=true
```

O painel ainda exige seleção de Conta Real e confirmação antes de iniciar.
