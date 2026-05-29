@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"
title DF Forex Pro - Upload GitHub

set "REPO_URL=https://github.com/dfforex/dfforex.git"

echo ============================================================
echo  DF Forex Pro - Subir para GitHub
echo ============================================================
echo Repositorio: %REPO_URL%
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Git nao encontrado. Rode INSTALAR_TUDO_DF_FOREX.bat primeiro.
  pause
  exit /b 1
)

if not exist .git (
  git init
)

if exist .env (
  echo [INFO] .env existe e NAO sera enviado por causa do .gitignore.
)

REM Garante gitignore seguro
(
echo .env
echo .env.*
echo ^!.env.example
echo node_modules/
echo .netlify/
echo dist/
echo *.log
echo mt5_compile.log
echo NETLIFY_ENV_COPIAR.txt
) > .gitignore

git remote remove origin >nul 2>nul
git remote add origin %REPO_URL%
git add .
git commit -m "DF Forex Pro v3.3 instalador completo MT5 Bridge" || echo [INFO] Nada novo para commitar ou commit ja existente.

git branch -M main
git pull origin main --allow-unrelated-histories --no-rebase || echo [AVISO] Pull falhou ou repositorio remoto vazio. Vou tentar push mesmo assim.
git push -u origin main

if errorlevel 1 (
  echo.
  echo [ERRO] Push falhou. Verifique login do GitHub/Git Credential Manager.
) else (
  echo.
  echo [OK] Arquivos enviados para o GitHub.
)
pause
