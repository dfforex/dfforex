# Instalador Windows - DF Forex Pro v3.3

Arquivos principais:

- `INSTALAR_TUDO_DF_FOREX.bat`: instala Git/Node, dependências, cria `.env`, prepara variáveis do Netlify e copia o EA para o MT5 se encontrar a pasta `MQL5/Experts`.
- `INSTALAR_EA_MT5.bat`: instala somente o EA Bridge no MetaTrader 5.
- `RODAR_LOCALHOST.bat`: abre o painel local em `http://localhost:8787`.
- `SUBIR_PARA_GITHUB_DF_FOREX.bat`: envia os arquivos para `https://github.com/dfforex/dfforex.git`.
- `NETLIFY_ENV_COPIAR.txt`: é gerado pelo instalador com as variáveis para copiar no Netlify.

## Importante

O instalador não libera operação real. O `.env` nasce com:

```env
BOT_MODE=dry_run
ACCOUNT_TYPE=demo
ENABLE_ORDER_EXECUTION=false
ALLOW_LIVE_TRADING=false
MT5_ALLOW_REAL_TRADING=false
```

Para funcionar de verdade com o MT5:

1. Rode `supabase/mt5_bridge_schema.sql` no Supabase.
2. Configure as variáveis do Netlify.
3. Instale o EA no MetaTrader 5.
4. No MT5, libere WebRequest para `https://df-forex.netlify.app`.
5. Arraste o EA para um gráfico e configure `MT5_BRIDGE_ID` e `MT5_BRIDGE_SECRET` iguais aos do Netlify.
