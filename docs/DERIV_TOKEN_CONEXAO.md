# DF Forex Pro v2.6 — Conexão Deriv por Token API

Esta versão adiciona conexão direta por Token API Deriv para evitar erro `invalid_client` do OAuth quando o App ID não está configurado corretamente.

## Opção recomendada para operar agora

1. Acesse: https://app.deriv.com/account/api-token
2. Crie um token com escopos:
   - `Read` para testar conexão e saldo;
   - `Trade` para permitir compra/venda de contratos quando as travas do Netlify forem liberadas.
3. No painel DF Forex Pro, vá em **Operação > Token API**.
4. Cole o token e clique em **Conectar com token**.
5. O botão/card muda para **Deriv conectada** e mostra a conta ativa.

O token não é salvo no Supabase nem no GitHub. Ele fica apenas na sessão do navegador (`sessionStorage`) e é enviado para as Netlify Functions como `Authorization: Bearer ...`.

## OAuth/Login Deriv

O OAuth continua disponível, mas para funcionar precisa de:

- `DERIV_AUTH_MODE=legacy_oauth`
- `DERIV_APP_ID` ou `DERIV_LEGACY_APP_ID` com um App ID válido
- Redirect/Website URL no app Deriv exatamente:

```text
https://df-forex.netlify.app/deriv-callback.html
```

Se a Deriv abrir uma página `invalid_client`, o problema é App ID inválido, ausente ou incompatível com o modo OAuth usado.
