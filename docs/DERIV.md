# Deriv API no DF Forex Pro

Esta versão usa Deriv API por WebSocket dentro de funções serverless e agora inclui login pela tela oficial da Deriv.

## Opções de autenticação

### 1. Login oficial Deriv no navegador — recomendado para teste manual

O botão **Entrar com Deriv** redireciona o usuário para a tela oficial da Deriv.

O DF Forex Pro **não coleta login nem senha**. A senha é digitada apenas na página oficial da Deriv.

Depois do login, a Deriv retorna para:

```text
https://SEU-SITE.netlify.app/deriv-callback.html
```

No painel de app da Deriv API, configure o **Website URL** exatamente com essa URL.

Variáveis:

```env
DERIV_AUTH_MODE=legacy_oauth_or_pat
DERIV_APP_ID=SEU_APP_ID_DERIV
DERIV_LEGACY_APP_ID=SEU_APP_ID_DERIV
```

### 2. Token manual/PAT por ambiente — bom para automações backend

```env
DERIV_API_TOKEN_DEMO=SEU_TOKEN_DEMO_DERIV
DERIV_API_TOKEN_LIVE=
```

Use token demo primeiro.

### 3. OAuth2 PKCE moderno — preparado, mas ainda não é a rota principal do robô

A Deriv possui OAuth2 com Authorization Code + PKCE. Esta versão inclui `/api/deriv-oauth-exchange`, mas a rota principal do robô continua usando WebSocket v3. Para WebSocket v3, use login legado ou PAT.

## Testes disponíveis

- `/api/deriv-test`: testa conexão, autorização e lista símbolos.
- `/api/deriv-oauth-url`: gera URL oficial de login Deriv legado.
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

## Observação importante

Netlify Functions não são ideais para manter WebSocket conectado 24h. Para execução real contínua, usar worker separado.
