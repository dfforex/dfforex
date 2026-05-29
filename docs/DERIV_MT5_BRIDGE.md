# DF Forex Pro — Deriv MT5 Bridge

O número exibido na Deriv em **CFDs > MT5** é o **Login ID do MetaTrader 5**. Ele não é um token da Deriv API.

## Diferença importante

- **Deriv API Token**: usado pelo painel Netlify para contratos/options pela API WebSocket da Deriv.
- **Deriv MT5 Login ID + Server**: usado no MetaTrader 5 para Forex/CFD tradicional. Para automação em MT5, é necessário rodar um **Expert Advisor** no MT5 desktop ou VPS.

O Web Terminal da Deriv permite abrir operações manualmente, mas não é o ambiente ideal para rodar Expert Advisors. Para automatizar, use o MT5 desktop/VPS.

## Como configurar o Bridge

1. Instale o Deriv MT5 desktop.
2. Faça login na conta demo exibida pela Deriv.
3. Abra o MetaEditor e copie o arquivo:

```text
mt5/DF_Forex_Pro_Bridge.mq5
```

para a pasta de Experts do MT5.

4. No MT5, vá em:

```text
Tools > Options > Expert Advisors
```

5. Marque **Allow WebRequest for listed URL** e adicione:

```text
https://df-forex.netlify.app
```

6. No Netlify, crie uma variável segura:

```env
MT5_BRIDGE_TOKEN=crie_um_token_longo_e_secreto
```

7. No EA, preencha o mesmo token no campo `BridgeToken`.
8. Arraste o EA para um gráfico e deixe `AllowTrading=false` primeiro.
9. No painel, vá em **Corretora > Deriv MT5 Bridge** e clique em **Status Bridge**.

## Segurança

A versão v2.7 envia heartbeat e status para o painel, mas não dispara ordens automáticas por padrão. A execução de ordens em MT5 deve ser liberada somente depois da demo validar a estratégia e o Risk Engine.
