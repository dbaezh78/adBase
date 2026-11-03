@echo off
title Contabilidad dBase - Windows AD & RADIUS Gateway
cd /d "C:\db\Github\EasyDataAccounting"
"C:\Program Files\nodejs\node.exe" "C:\db\Github\EasyDataAccounting\src\js\server\windows-ad-ldap-radius-gateway.js"
pause