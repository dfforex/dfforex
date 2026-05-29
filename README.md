# DF Forex Pro v2.1 — Netlify/Node, sem Python local, com Login Deriv

Esta versão foi criada para subir no GitHub e publicar no Netlify sem depender de Python no computador.

## O que esta versão faz

- Abre um painel web estático em `site/`.
- Usa Netlify Functions em Node.js como backend.
- Lê dados do Supabase somente no backend.
- Testa conexão com Deriv API via WebSocket.
- Inclui botão “Entrar com Deriv”, usando a tela oficial da Deriv, sem coletar senha no painel.
- Busca candles da Deriv.
- Roda a estratégia inicial `DF_TREND_PULLBACK_CORE` em modo `dry_run`.
- Registra sinais e rejeições no Supabase quando as variáveis de ambiente estiverem configuradas.
- Mantém execução real bloqueada por padrão.

## O que esta versão NÃO faz ainda

- Não depende de MetaTrader 5.
- Não depende de Python.
- Não mantém processo 24h rodando dentro do Netlify.
- Não envia ordens reais por padrão.
- Não promete lucro, rentabilidade ou acerto.

Para execução real contínua, o ideal será usar um worker separado em VPS/Railway/Render/Fly.io ou Deriv API com serviço sempre ativo. O Netlify é excelente para painel, API serverless, dry-run e varreduras agendadas, mas não é o melhor lugar para um robô de trading que precisa ficar conectado 24h por WebSocket.

## Estrutura

```text
DF_Forex_Pro_v2_NETLIFY_NODE_ONLY/
├── site/
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── netlify/
│   └── functions/
│       ├── health.js
│       ├── config-status.js
│       ├── dashboard.js
│       ├── deriv-test.js
│       ├── deriv-candles.js
│       ├── bot-run-once.js
│       ├── scheduled-scan.js
│       ├── signals.js
│       └── orders.js
├── lib/
│   ├── config.js
│   ├── derivClient.js
│   ├── http.js
│   ├── indicators.js
│   ├── marketRegime.js
│   ├── riskEngine.js
│   ├── strategyTrendPullback.js
│   └── supabaseAdmin.js
├── supabase/
│   └── schema_netlify.sql
├── docs/
│   ├── NETLIFY_ENV.md
│   ├── GITHUB_PUSH.md
│   ├── DERIV.md
│   └── ROADMAP.md
├── package.json
├── netlify.toml
├── .env.example
└── README.md
```

## Como publicar no GitHub

1. Crie um repositório vazio no GitHub.
2. Extraia este ZIP.
3. Abra o CMD dentro da pasta extraída.
4. Execute:

```bat
git init
git add .
git commit -m "DF Forex Pro v2 Netlify Node"
git branch -M main
git remote add origin URL_DO_SEU_REPOSITORIO
git push -u origin main
```

## Como publicar no Netlify

1. Entre no Netlify.
2. Clique em **Add new site**.
3. Escolha **Import an existing project**.
4. Selecione o repositório do GitHub.
5. Build command: `npm run build`.
6. Publish directory: `site`.
7. Functions directory já está no `netlify.toml`.
8. Configure as variáveis de ambiente.

## Variáveis de ambiente obrigatórias no Netlify

Configure em **Site configuration > Environment variables**:

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

Nunca coloque `service_role`, token Deriv ou qualquer segredo no frontend.

## Supabase

Aplique o SQL:

```text
supabase/schema_netlify.sql
```

no SQL Editor do Supabase.

## Endpoints

- `/api/health`
- `/api/config-status`
- `/api/dashboard`
- `/api/deriv-test`
- `/api/deriv-candles?symbol=frxEURUSD&granularity=3600&count=240`
- `/api/bot-run-once`
- `/api/signals`
- `/api/orders`

## Segurança

Por padrão, mesmo que o token Deriv seja configurado, o robô não envia ordem real porque as travas ficam assim:

```env
BOT_MODE=dry_run
ENABLE_ORDER_EXECUTION=false
ALLOW_LIVE_TRADING=false
DERIV_ENABLE_ORDER_EXECUTION=false
```

Para desenvolver estratégia, use somente demo/dry-run.


## Login com Deriv

A Deriv não deve receber login e senha dentro do nosso painel. O fluxo implementado abre a página oficial da Deriv e retorna para:

```text
/deriv-callback.html
```

Configure o Website URL do app no painel Deriv API como:

```text
https://SEU-SITE.netlify.app/deriv-callback.html
```

Para testes locais via Netlify Dev, use:

```text
http://localhost:8787/deriv-callback.html
```

O token retornado fica apenas na sessão do navegador e é enviado ao backend via `Authorization: Bearer` quando você clica em **Testar Deriv** ou **Rodar análise dry-run**.
