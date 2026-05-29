# Subir no GitHub pelo CMD

Entre na pasta do projeto e rode:

```bat
git init
git add .
git commit -m "DF Forex Pro v2 Netlify Node"
git branch -M main
git remote add origin URL_DO_REPOSITORIO
git push -u origin main
```

Se o repositório já tiver arquivos e der erro de histórico diferente:

```bat
git pull origin main --allow-unrelated-histories
git push -u origin main
```
