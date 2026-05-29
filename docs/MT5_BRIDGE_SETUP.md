# DF Forex Pro v3.1 — Setup MT5 Bridge

Esta versão abandona o login OAuth da Deriv como conexão principal. A operação passa a ser feita por MetaTrader 5.

## Fluxo correto

1. Abra o MetaTrader 5 da Deriv.
2. Faça login com **Login ID + senha + servidor**.
3. Instale o EA `mt5/DF_Forex_Pro_Bridge.mq5`.
4. Libere WebRequest para `https://df-forex.netlify.app`.
5. O painel Netlify envia comandos ao Supabase/Netlify.
6. O EA lê comandos e executa no MT5.
7. O painel mostra sinais, ordens, ganho, perda e logs.

## WebRequest no MT5

No MetaTrader:

`Ferramentas > Opções > Expert Advisors > Permitir WebRequest para URLs listadas`

Adicionar:

```text
https://df-forex.netlify.app
```

## Variáveis Netlify

```env
PUBLIC_SITE_URL=https://df-forex.netlify.app
BROKER_CONNECTOR=mt5_bridge
MT5_BRIDGE_ID=df-forex-main
MT5_BRIDGE_SECRET=crie_um_segredo_forte
MT5_SERVER=Deriv-Demo
MT5_LOGIN=32243508

BOT_MODE=dry_run
ACCOUNT_TYPE=demo
ENABLE_ORDER_EXECUTION=false
ALLOW_LIVE_TRADING=false
MT5_ALLOW_REAL_TRADING=false

MAX_RISK_PER_TRADE_PCT=0.5
MIN_SIGNAL_SCORE=80
FOREX_SYMBOLS=EURUSD,GBPUSD,USDJPY,XAUUSD
```

Para demo operacional, depois de validar:

```env
BOT_MODE=live
ACCOUNT_TYPE=demo
ENABLE_ORDER_EXECUTION=true
ALLOW_LIVE_TRADING=false
MT5_ALLOW_REAL_TRADING=false
```

Para real, somente com validação manual:

```env
BOT_MODE=live
ACCOUNT_TYPE=real
ENABLE_ORDER_EXECUTION=true
ALLOW_LIVE_TRADING=true
MT5_ALLOW_REAL_TRADING=true
```

## Supabase

Rode o arquivo:

```text
supabase/mt5_bridge_schema.sql
```

## Segurança

A senha MT5 não deve ir para GitHub, Netlify, Supabase ou navegador. Ela deve ser usada diretamente no MetaTrader 5.
