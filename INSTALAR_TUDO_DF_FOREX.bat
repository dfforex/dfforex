@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title DF Forex Pro v3.3 - Instalador Completo

echo ============================================================
echo  DF Forex Pro v3.3 - Instalador Completo Windows
echo ============================================================
echo.
echo Este BAT vai chamar o instalador PowerShell para:
echo  - verificar/instalar Git
echo  - verificar/instalar Node.js LTS
echo  - instalar dependencias npm
echo  - criar .env local seguro
echo  - preparar variaveis para Netlify
echo  - copiar o EA Bridge para o MetaTrader 5, se encontrado
echo.
echo Modo inicial: DEMO / DRY_RUN / SEM ORDEM REAL.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows_setup\instalar_tudo.ps1"

echo.
pause
