@echo off
setlocal
title Instalador Servicio Windows - Contabilidad dBase
echo =======================================================================
echo   CONTABILIDAD DBASE - INSTALACION DE SERVICIO WINDOWS (AD/LDAP/RADIUS)
echo =======================================================================
echo.

cd /d "%~dp0"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-windows-service.ps1"

echo.
pause
