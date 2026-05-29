# DF Forex Pro v2.9 — Netlify + Deriv PAT + Supabase + MT5 Bridge

Painel operacional para automação Forex/Deriv com:

- layout premium separado por abas internas;
- conexão por **Token API Deriv / PAT**;
- conexão OAuth mantida como alternativa;
- seleção de Conta Demo ou Conta Real;
- botão **Iniciar operações**;
- execução de scans automáticos enquanto a aba está aberta;
- registro de sinais e entradas no Supabase;
- sincronização de contratos abertos para mostrar ganho/perda;
- travas de segurança para impedir operação real acidental;
- opção **Deriv MT5 Bridge** para Forex/CFD tradicional via MetaTrader 5.

## Site

```text
https://df-forex.netlify.app
```

## Deploy Netlify

```text
Build command: npm run build
Publish directory: site
Functions directory: netlify/functions
```

## Variáveis obrigatórias no Netlify

Nunca coloque tokens dentro do GitHub. Configure em:

```text
Netlify > Site configuration > Environment variables
```

```env
PUBLIC_SITE_URL=https://df-forex.netlify.app
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

## Conexão por Token API Deriv / PAT

Para demo:

```env
DERIV_API_TOKEN_DEMO=COLE_SEU_TOKEN_DEMO_DERIV_AQUI
ACCOUNT_TYPE=demo
```

Para real:

```env
DERIV_API_TOKEN_LIVE=COLE_SEU_TOKEN_REAL_DERIV_AQUI
ACCOUNT_TYPE=real
```

O painel também permite colar o token temporariamente na aba **Operação > Token API**. Nesse caso, o token fica só na sessão do navegador.

## Modo seguro padrão

```env
BOT_MODE=dry_run
ACCOUNT_TYPE=demo
ENABLE_ORDER_EXECUTION=false
DERIV_ENABLE_ORDER_EXECUTION=false
ALLOW_LIVE_TRADING=false
```

## Operação demo pela Deriv API

Depois de validar conexão, Supabase e painel:

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

Somente depois da demo validada:

```env
BOT_MODE=live
ACCOUNT_TYPE=real
ENABLE_ORDER_EXECUTION=true
DERIV_ENABLE_ORDER_EXECUTION=true
ALLOW_LIVE_TRADING=true
```

O painel ainda exige seleção de Conta Real e confirmação antes de iniciar.

## Deriv MT5 Bridge

A Deriv API direta opera contratos da plataforma Deriv API. Para Forex/CFD tradicional com MT5, lote, stop loss e take profit, use a aba **Deriv MT5** e o Expert Advisor:

```text
mt5/DF_Forex_Pro_Bridge.mq5
```

O painel Netlify não consegue controlar o MT5 sozinho. O MT5 precisa estar aberto no desktop/VPS com o EA Bridge rodando.

Leia: `docs/DERIV_MT5_BRIDGE.md`.
