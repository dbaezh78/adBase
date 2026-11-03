' Contabilidad dBase - Windows AD & RADIUS Gateway Silent Runner
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\\db\\Github\\EasyDataAccounting"
WshShell.Run """C:\\Program Files\\nodejs\\node.exe"" ""C:\\db\\Github\\EasyDataAccounting\\src\\js\\server\\windows-ad-ldap-radius-gateway.js""", 0, False
Set WshShell = Nothing