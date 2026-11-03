@echo off
setlocal
title Desinstalador Servicio Windows - Contabilidad dBase
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall-windows-service.ps1"
pause
