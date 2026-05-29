# DF Forex Pro v3.4 — MT5 Bridge Principal

Versão corrigida para operar via MetaTrader 5/Deriv MT5, usando login, senha e servidor diretamente no terminal MT5.

## O que mudou

- Removido OAuth Deriv como fluxo principal.
- Painel reorganizado por abas internas.
- Nova aba **Configuração MT5**.
- Novo EA `mt5/DF_Forex_Pro_Bridge.mq5`.
- Comandos via Netlify Functions + Supabase.
- Sinais, ordens, ganho/perda e logs reportados pelo MT5 Bridge.

## Deploy

Build command:

```bash
npm run build
```

Publish directory:

```text
site
```

## SQL

Rode no Supabase:

```text
supabase/mt5_bridge_schema.sql
```

## Netlify env

Veja `docs/MT5_BRIDGE_SETUP.md`.

## Atenção

Este projeto não promete lucro. Use primeiro em demo. Conta real só deve ser liberada após validação em demo e com travas de risco.


## Instalador completo Windows v3.4

Use `INSTALAR_TUDO_DF_FOREX.bat` para preparar o ambiente local, dependências Node, `.env`, variáveis do Netlify e instalação do EA Bridge no MetaTrader 5. O modo padrão continua seguro: DEMO / DRY_RUN / SEM ORDEM REAL.

## v3.4 - Ambiente provisório pré-preenchido

Esta versão inclui `.env` local e `NETLIFY_ENV_COPIAR.txt` já preenchidos para teste.
Esses arquivos são sensíveis e estão no `.gitignore`, portanto o bot de upload não deve enviá-los ao GitHub.
Depois de validar o fluxo completo, rotacione/troque as chaves no Supabase e atualize as variáveis no Netlify.

## v3.4 - Diagnóstico de MT5 Offline

Esta versão corrige o ponto mais comum do painel ficar `MT5 Bridge Offline`: o EA agora já vem com o `BridgeSecret` provisório preenchido e mostra diagnóstico direto no gráfico do MetaTrader 5.

Use primeiro:

```bat
INSTALAR_E_REINSTALAR_EA_MT5.bat
```

Depois, no MT5:

1. Navegador > Expert Advisors > Atualizar.
2. Arraste `DF_Forex_Pro_Bridge` para um gráfico.
3. Marque `Permitir Algo Trading`.
4. Libere WebRequest para `https://df-forex.netlify.app`.
5. Veja no gráfico se aparece `DF Forex Pro Bridge v3.4` e `Último HTTP: 200`.

Se o painel continuar Offline, abra o arquivo `DIAGNOSTICO_MT5_OFFLINE.txt`.
