@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title DF Forex Pro - Localhost

echo Iniciando DF Forex Pro em http://localhost:8787 ...
if not exist node_modules (
  echo node_modules nao encontrado. Instalando dependencias...
  npm install
)
start "" "http://localhost:8787"
npm run dev
pause
