# Correção do Login Deriv — App ID obrigatório

O fluxo correto do login oficial da Deriv não usa e-mail/senha dentro do DF Forex Pro.
O painel redireciona para a página oficial da Deriv e a Deriv retorna para o callback do nosso site.

## Configuração obrigatória

1. Acesse o Deriv Application Manager / API app registration.
2. Crie ou abra seu app.
3. Copie o **App ID** gerado pela Deriv.
4. Configure o Website/OAuth Redirect URL exatamente como:

```text
https://df-forex.netlify.app/deriv-callback.html
```

5. No Netlify, adicione:

```env
PUBLIC_SITE_URL=https://df-forex.netlify.app
DERIV_AUTH_MODE=legacy_oauth
DERIV_LEGACY_APP_ID=SEU_APP_ID_REAL_DERIV
DERIV_APP_ID=SEU_APP_ID_REAL_DERIV
```

## Por que dava invalid_client

O erro `invalid_client` ocorre quando o botão de login é enviado sem App ID, com App ID inválido, ou com callback diferente do cadastrado no app da Deriv.

## Alternativa estável

A conexão por Token API continua disponível na aba Operação > Token API. Ela não depende do OAuth nem do redirect URL.
