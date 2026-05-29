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
DERIV_LEGACY_APP_ID=SEU_APP_ID_DERIV
DERIV_AUTH_MODE=legacy_oauth_or_pat
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


## Login oficial Deriv

Para o botão **Entrar com Deriv** funcionar, cadastre o Website URL no painel de apps da Deriv como:

```text
https://SEU-SITE.netlify.app/deriv-callback.html
```

O DF Forex Pro não deve ter campos de login/senha da Deriv. O login acontece somente na página oficial da Deriv.
