# Correção do retorno automático da Deriv

Se o login cair em `home.deriv.com/dashboard/home` e não voltar para o painel, o login foi iniciado sem um app OAuth válido apontando para o callback do DF Forex Pro, ou o `Website URL` do app Deriv está incorreto.

## Callback obrigatório

Configure no app/API da Deriv:

```text
https://df-forex.netlify.app/deriv-callback.html
```

## Opção recomendada: OAuth2 PKCE

No Netlify, configure:

```env
PUBLIC_SITE_URL=https://df-forex.netlify.app
DERIV_AUTH_MODE=oauth2_pkce
DERIV_OAUTH_CLIENT_ID=SEU_CLIENT_ID_DERIV
DERIV_OAUTH_REDIRECT_URI=https://df-forex.netlify.app/deriv-callback.html
DERIV_OAUTH_SCOPE=trade account_manage
DERIV_LEGACY_APP_ID=SEU_APP_ID_LEGACY_SE_TIVER
```

Nesse modo, o botão `Conectar Deriv` envia o usuário para `https://auth.deriv.com/oauth2/auth` com `redirect_uri` explícito. Após o login, a Deriv deve retornar para `/deriv-callback.html` com `code` e `state`.

## Fallback: OAuth legado

No Netlify, configure:

```env
PUBLIC_SITE_URL=https://df-forex.netlify.app
DERIV_AUTH_MODE=legacy_oauth_or_pat
DERIV_LEGACY_APP_ID=SEU_APP_ID_DERIV
```

No app/API legacy da Deriv, o campo `Website URL` precisa ser exatamente:

```text
https://df-forex.netlify.app/deriv-callback.html
```

Não use o app_id padrão `1089` em produção. Se usar o app_id padrão ou um app_id sem Website URL correto, a Deriv pode enviar o usuário para `home.deriv.com` e o painel não consegue capturar o token.

## O que foi corrigido na v2.4

- O app agora prioriza OAuth2 PKCE quando `DERIV_OAUTH_CLIENT_ID` está configurado.
- O backend gera `state`, `code_verifier` e `code_challenge`.
- O painel salva o `code_verifier` na sessão antes de redirecionar.
- O callback troca o `code` por token via Netlify Function.
- O fallback legacy continua funcionando.
- Se a Deriv retornar os tokens na página principal `/` por engano, o painel também captura `acct1`, `token1`, `cur1` e limpa a URL.
