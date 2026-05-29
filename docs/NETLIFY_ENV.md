# Variáveis de ambiente no Netlify

Vá em:

```text
Netlify > Site configuration > Environment variables
```

Adicione:

```env
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=SUA_SERVICE_ROLE_DO_SUPABASE
BOT_MODE=dry_run
ACCOUNT_TYPE=demo
ENABLE_ORDER_EXECUTION=false
ALLOW_LIVE_TRADING=false
BROKER_CONNECTOR=deriv_api
DERIV_APP_ID=SEU_APP_ID_DERIV
DERIV_API_TOKEN_DEMO=SEU_TOKEN_DEMO_DERIV
DERIV_TRADE_MODE=data_only
DERIV_ENABLE_ORDER_EXECUTION=false
FOREX_SYMBOLS=frxEURUSD,frxGBPUSD,frxUSDJPY,frxAUDUSD
DEFAULT_TIMEFRAME_MINUTES=60
MAX_RISK_PER_TRADE_PCT=0.50
MAX_DAILY_LOSS_PCT=2
MAX_WEEKLY_LOSS_PCT=5
MAX_MONTHLY_DRAWDOWN_PCT=10
MIN_SIGNAL_SCORE=80
```

## Importante

- `SUPABASE_SERVICE_ROLE_KEY` nunca deve aparecer no frontend.
- Token Deriv também nunca deve aparecer no frontend.
- Esta versão usa as chaves apenas dentro das Netlify Functions.
