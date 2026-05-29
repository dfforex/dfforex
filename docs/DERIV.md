# Deriv API no DF Forex Pro

Esta versão usa Deriv API por WebSocket dentro de funções serverless.

## Testes disponíveis

- `/api/deriv-test`: testa conexão, autorização e lista símbolos.
- `/api/deriv-candles?symbol=frxEURUSD&granularity=3600&count=240`: busca candles.
- `/api/bot-run-once`: busca candles, calcula sinal e salva no Supabase.

## Modos

Modo inicial seguro:

```env
BOT_MODE=dry_run
ACCOUNT_TYPE=demo
ENABLE_ORDER_EXECUTION=false
DERIV_ENABLE_ORDER_EXECUTION=false
```

Esse modo não envia ordens.

## Observação

Netlify Functions não são ideais para manter WebSocket conectado 24h. Para execução real contínua, usar worker separado.
