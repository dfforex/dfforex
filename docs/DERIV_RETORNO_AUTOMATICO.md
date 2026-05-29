# DF Forex Pro v2.6 - Retorno automático Deriv

Para o login voltar ao painel, use o OAuth legado da Deriv neste projeto:

```env
PUBLIC_SITE_URL=https://df-forex.netlify.app
DERIV_AUTH_MODE=legacy_oauth
DERIV_LEGACY_APP_ID=SEU_APP_ID_DERIV
DERIV_APP_ID=SEU_APP_ID_DERIV
```

No Application Manager da Deriv/API, configure o Website/OAuth Redirect URL exatamente como:

```text
https://df-forex.netlify.app/deriv-callback.html
```

O login deve abrir:

```text
https://oauth.deriv.com/oauth2/authorize?app_id=SEU_APP_ID_DERIV
```

Depois do login, a Deriv retorna tokens no callback, por exemplo `acct1`, `token1`, `cur1`.

Se cair em `home.deriv.com` ou em página 404 da Deriv, o App ID/redirect URL ainda não está correto ou o ambiente do Netlify está usando OAuth2 PKCE sem client válido.
