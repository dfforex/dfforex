# Deriv no DF Forex Pro

## Login seguro

O DF Forex Pro não pede e-mail/senha da Deriv dentro do nosso painel. O botão **Conectar Deriv** abre a tela oficial da Deriv via OAuth. Depois que o usuário aprova, a Deriv redireciona para:

```text
https://delicate-longma-e8f8d2.netlify.app/deriv-callback.html
```

O callback salva o token somente na sessão do navegador e retorna automaticamente para o painel principal.

## Configuração obrigatória

No cadastro do app/API da Deriv, coloque o Website URL:

```text
https://delicate-longma-e8f8d2.netlify.app/deriv-callback.html
```

Local:

```text
http://localhost:8787/deriv-callback.html
```

## Segurança

- A senha da Deriv nunca passa pelo DF Forex Pro.
- Tokens de ambiente ficam no Netlify, não no GitHub.
- O token vindo do login Deriv fica no navegador/sessão.
- Execução real continua bloqueada até ativação manual e validação.
