# ==============================================================================
# Contabilidad dBase - Instalador de Servicio de Windows para Gateway AD/RADIUS
# Registra el microservicio como Servicio / Tarea Permanente de Windows
# ==============================================================================

$ServiceName = "ContabilidadDbaseGateway"
$ServiceDisplay = "Contabilidad dBase - Windows AD & RADIUS Gateway Service"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$GatewayScript = Join-Path $ProjectRoot "src\js\server\windows-ad-ldap-radius-gateway.js"
$VbsRunner = Join-Path $ProjectRoot "ContabilidadDbaseGatewaySilent.vbs"
$StartupFolder = [System.IO.Path]::Combine($env:APPDATA, "Microsoft\Windows\Start Menu\Programs\Startup")
$StartupLnk = Join-Path $StartupFolder "$ServiceName.lnk"
$NodeCmd = Get-Command node.exe -ErrorAction SilentlyContinue

if (-not $NodeCmd) {
    Write-Host "[ERROR] Node.js no se encuentra en el PATH del sistema." -ForegroundColor Red
    Exit 1
}
$NodeExe = $NodeCmd.Source

Write-Host "=======================================================================" -ForegroundColor Cyan
Write-Host "  CONTABILIDAD DBASE - INSTALADOR DE SERVICIO WINDOWS (AD/RADIUS)     " -ForegroundColor Cyan
Write-Host "=======================================================================" -ForegroundColor Cyan
Write-Host "Directorio: $ProjectRoot"
Write-Host "Node.js:    $NodeExe"
Write-Host "Script:     $GatewayScript"
Write-Host ""

# 1. Generar VBScript Silent Runner para ejecucion invisible en Windows
$VbsLines = @(
    "' Contabilidad dBase - Windows AD & RADIUS Gateway Silent Runner",
    "Set WshShell = CreateObject(""WScript.Shell"")",
    "WshShell.CurrentDirectory = ""$ProjectRoot""",
    "WshShell.Run """"""$NodeExe"""" """"""$GatewayScript"""""", 0, False",
    "Set WshShell = Nothing"
)
$VbsLines | Set-Content -Path $VbsRunner -Encoding ASCII
Write-Host "[OK] Lanzador silencioso generado: $VbsRunner" -ForegroundColor Green

# 2. Registrar en Inicio de Windows (Startup de Usuario)
try {
    $wsh = New-Object -ComObject WScript.Shell
    $shortcut = $wsh.CreateShortcut($StartupLnk)
    $shortcut.TargetPath = "wscript.exe"
    $shortcut.Arguments = "`"$VbsRunner`""
    $shortcut.WorkingDirectory = $ProjectRoot
    $shortcut.Description = $ServiceDisplay
    $shortcut.Save()
    Write-Host "[OK] Acceso directo registrado en Inicio de Windows: $StartupLnk" -ForegroundColor Green
} catch {
    Write-Host "[AVISO] No se pudo escribir en la carpeta Inicio: $($_.Exception.Message)" -ForegroundColor Yellow
}

# 3. Intentar registrar en el Programador de Tareas (schtasks) si se ejecuta con permisos de Administrador
$IsAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if ($IsAdmin) {
    Write-Host "[INFO] Modo Administrador detectado: Registrando tarea de arranque del sistema..." -ForegroundColor Yellow
    schtasks.exe /create /tn "$ServiceName" /tr "wscript.exe `"$VbsRunner`"" /sc ONSTART /ru SYSTEM /f /rl HIGHEST 2>&1 | Out-Null
    Write-Host "[OK] Tarea de arranque del sistema '$ServiceName' registrada en Programador de Tareas." -ForegroundColor Green
} else {
    Write-Host "[INFO] Ejecutando sin elevacion de administrador: El servicio iniciara automaticamente mediante la carpeta Inicio de Windows ($StartupLnk)." -ForegroundColor Cyan
}

# 4. Arrancar el servicio de inmediato
Write-Host "[INFO] Comprobando ejecucion en puerto 3890..." -ForegroundColor Cyan
try {
    $res = Invoke-RestMethod -Uri "http://127.0.0.1:3890/api/health" -TimeoutSec 2 -ErrorAction Stop
    Write-Host "[OK] El Gateway ya esta respondiendo en http://127.0.0.1:3890." -ForegroundColor Green
} catch {
    Write-Host "[INFO] Iniciando el Gateway en segundo plano..." -ForegroundColor Cyan
    Start-Process "wscript.exe" -ArgumentList "`"$VbsRunner`"" -WorkingDirectory $ProjectRoot
    Start-Sleep -Seconds 2
}

try {
    $final = Invoke-RestMethod -Uri "http://127.0.0.1:3890/api/health" -TimeoutSec 3 -ErrorAction Stop
    Write-Host ""
    Write-Host "=======================================================================" -ForegroundColor Green
    Write-Host "✓ SERVICIO INSTALADO Y EN EJECUCION EXITOSA" -ForegroundColor Green
    Write-Host "  Nombre:       $ServiceName"
    Write-Host "  Puerto Local: http://127.0.0.1:3890"
    Write-Host "  Estado:       $($final.status)"
    Write-Host "  Servicio:     $($final.service)"
    Write-Host "=======================================================================" -ForegroundColor Green
} catch {
    Write-Host "[AVISO] El proceso se inicio. Compruebe su estado con 'npm run service:status'." -ForegroundColor Yellow
}
