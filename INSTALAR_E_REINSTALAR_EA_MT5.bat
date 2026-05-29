@echo off
chcp 65001 >nul
cd /d "%~dp0"
title DF Forex Pro v3.4 - Reinstalar EA MT5
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows_setup\instalar_ea_mt5.ps1"
pause
