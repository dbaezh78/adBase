# ==============================================================================
# Contabilidad dBase - Desinstalador de Servicio de Windows para Gateway AD/RADIUS
# ==============================================================================

$ServiceName = "ContabilidadDbaseGateway"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$VbsRunner = Join-Path $ProjectRoot "ContabilidadDbaseGatewaySilent.vbs"
$StartupFolder = [System.IO.Path]::Combine($env:APPDATA, "Microsoft\Windows\Start Menu\Programs\Startup")
$StartupLnk = Join-Path $StartupFolder "$ServiceName.lnk"

Write-Host "Deteniendo y eliminando servicio $ServiceName..." -ForegroundColor Cyan

# 1. Detener tarea en Task Scheduler si existe
try {
    schtasks.exe /end /tn "$ServiceName" 2>&1 | Out-Null
    schtasks.exe /delete /tn "$ServiceName" /f 2>&1 | Out-Null
} catch {}

# 2. Eliminar acceso directo de Inicio de Windows
if (Test-Path $StartupLnk) {
    Remove-Item -Path $StartupLnk -Force -ErrorAction SilentlyContinue
    Write-Host "[OK] Acceso directo eliminado de Inicio de Windows." -ForegroundColor Green
}

# 3. Matar proceso escuchando en 3890
try {
    $connections = Get-NetTCPConnection -LocalPort 3890 -ErrorAction SilentlyContinue
    foreach ($conn in $connections) {
        if ($conn.OwningProcess -gt 0) {
            Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
            Write-Host "[OK] Proceso PID $($conn.OwningProcess) detenido." -ForegroundColor Green
        }
    }
} catch {
    # Ignore
}

# 4. Eliminar lanzador silencioso
if (Test-Path $VbsRunner) {
    Remove-Item -Path $VbsRunner -Force -ErrorAction SilentlyContinue
}

Write-Host "[OK] Servicio $ServiceName desinstalado exitosamente." -ForegroundColor Green
