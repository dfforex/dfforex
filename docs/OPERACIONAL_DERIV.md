# DF Forex Pro v2.3 — Operacional Deriv Demo/Real

Esta versão transforma o painel em um fluxo operacional:

1. Conectar Deriv pela tela oficial OAuth.
2. Selecionar Conta Demo ou Conta Real.
3. Selecionar a conta retornada pela Deriv.
4. Definir stake e duração.
5. Clicar em **Iniciar operações**.
6. O painel executa scans automáticos a cada 60s enquanto a aba estiver aberta.
7. Os sinais e entradas são gravados no Supabase.
8. A função `deriv-sync-orders` atualiza contratos abertos e mostra ganho/perda.

## Importante sobre Netlify

Netlify Functions não ficam rodando continuamente como um VPS. Por isso, nesta versão o botão **Iniciar operações** faz a aba do navegador chamar a função `bot-run-once` a cada 60 segundos. Para automação totalmente autônoma, use Netlify Scheduled Functions, GitHub Actions, VPS ou servidor dedicado.

## Website URL na Deriv

Configure no app/API da Deriv:

```text
https://df-forex.netlify.app/deriv-callback.html
```

## Variáveis do Netlify para modo seguro

Modo visual/dry-run, sem ordem real:

```env
BOT_MODE=dry_run
ACCOUNT_TYPE=demo
ENABLE_ORDER_EXECUTION=false
DERIV_ENABLE_ORDER_EXECUTION=false
ALLOW_LIVE_TRADING=false
```

## Liberar operação em DEMO

Somente após testar login e Supabase:

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

## Liberar operação em REAL

Use apenas depois de validar em demo. É obrigatório liberar todas as travas:

```env
BOT_MODE=live
ACCOUNT_TYPE=real
ENABLE_ORDER_EXECUTION=true
DERIV_ENABLE_ORDER_EXECUTION=true
ALLOW_LIVE_TRADING=true
DERIV_DEFAULT_STAKE=1
MAX_TRADES_PER_RUN=1
```

O painel também exige seleção de Conta Real e confirmação manual antes de iniciar.

## Tipo de operação pela API Deriv

A Deriv API direta trabalha com contratos como Rise/Fall. Nesta versão:

- sinal `buy` vira contrato `CALL`;
- sinal `sell` vira contrato `PUT`;
- stake e duração são definidos no painel;
- contratos abertos são sincronizados via `proposal_open_contract`.

Para Forex CFD/MT5 com lotes, stop e take tradicionais, a arquitetura correta é Deriv MT5 em VPS/MT5, não apenas Netlify Functions.
