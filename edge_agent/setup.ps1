# Station-OS Edge Agent — Automated Setup
# Run this on the client's server PC to install the edge agent.
# Only 2 questions: owner email + station name. Everything else is automatic.

param(
    [string]$OwnerEmail = "",
    [string]$StationName = "",
    [string]$StationAddress = ""
)

# Atrapa cualquier error inesperado y pausa la ventana antes de cerrar
trap {
    Write-Host ""
    Write-Host "ERROR: $_" -ForegroundColor Red
    Write-Host ""
    Read-Host "Presiona Enter para cerrar"
    exit 1
}

# ─── Configuration (same for all stations) ────────────────────────────────────

$INSTALL_DIR   = "C:\StationOS"
$SUPABASE_URL  = "https://cmbafysulwyskxzhclhm.supabase.co"
$SERVICE_KEY   = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNtYmFmeXN1bHd5c2t4emhjbGhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDg5NzUxMiwiZXhwIjoyMDkwNDczNTEyfQ.Vfb0q2PBVK70ZXsocgJK0MF2crIYKAgSNvEEEKKHDAw"

$AUTH_HEADERS = @{
    "apikey"        = $SERVICE_KEY
    "Authorization" = "Bearer $SERVICE_KEY"
    "Content-Type"  = "application/json"
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  Station-OS Edge Agent - Instalador Automatico" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# ─── Check Administrator ──────────────────────────────────────────────────────

$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Reiniciando como Administrador..." -ForegroundColor Yellow
    Start-Process PowerShell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

# ─── Step 1: Check Python ─────────────────────────────────────────────────────

Write-Host "[1/6] Verificando Python..." -ForegroundColor Yellow

$pythonOk = $false
try {
    $ver = python --version 2>&1
    if ($ver -match "3\.(1[1-9]|[2-9]\d)") { $pythonOk = $true }
} catch {}

if (-not $pythonOk) {
    Write-Host "  Python 3.11+ no encontrado. Instalando..." -ForegroundColor Yellow
    try {
        winget install -e --id Python.Python.3.11 --accept-package-agreements --accept-source-agreements 2>$null
        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    } catch {
        Write-Host "  ERROR: No se pudo instalar Python automaticamente." -ForegroundColor Red
        Write-Host "  Descargalo manualmente: https://www.python.org/downloads/" -ForegroundColor Yellow
        Read-Host "  Presiona Enter despues de instalar Python"
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    }
}

$ver = python --version 2>&1
Write-Host "  OK: $ver" -ForegroundColor Green

# ─── Step 2: Ask 3 Questions ──────────────────────────────────────────────────

Write-Host ""
Write-Host "[2/6] Datos de la estacion" -ForegroundColor Yellow

if ([string]::IsNullOrWhiteSpace($OwnerEmail)) {
    $OwnerEmail = Read-Host "  Email del dueno (ej: cliente@gmail.com)"
}
if ([string]::IsNullOrWhiteSpace($StationName)) {
    $StationName = Read-Host "  Nombre de la estacion (ej: Estacion Ruta 5 Lujan)"
}
if ([string]::IsNullOrWhiteSpace($StationAddress)) {
    $StationAddress = Read-Host "  Direccion completa (ej: Ruta Nacional 5 km 65, Lujan, Buenos Aires)"
}

if ([string]::IsNullOrWhiteSpace($OwnerEmail) -or [string]::IsNullOrWhiteSpace($StationName) -or [string]::IsNullOrWhiteSpace($StationAddress)) {
    Write-Host "  ERROR: Datos incompletos." -ForegroundColor Red
    Read-Host "Presiona Enter para cerrar"
    exit 1
}

Write-Host "  Dueno:     $OwnerEmail" -ForegroundColor Gray
Write-Host "  Estacion:  $StationName" -ForegroundColor Gray
Write-Host "  Direccion: $StationAddress" -ForegroundColor Gray

# ─── Geocodificar dirección con Nominatim ─────────────────────────────────────

Write-Host ""
Write-Host "  Geocodificando direccion..." -ForegroundColor Gray

function Get-Coordinates($address) {
    $encoded = [Uri]::EscapeDataString($address)
    $url = "https://nominatim.openstreetmap.org/search?q=$encoded&format=json&limit=1"
    $headers = @{ "User-Agent" = "StationOS-Setup/1.0" }
    try {
        $result = Invoke-RestMethod -Uri $url -Headers $headers -TimeoutSec 10
        if ($result -and $result.Count -gt 0) {
            return @{ Lat = [double]$result[0].lat; Lng = [double]$result[0].lon; Ok = $true }
        }
    } catch {}
    return @{ Lat = -34.6037; Lng = -58.3816; Ok = $false }
}

$Coords = Get-Coordinates $StationAddress
$Lat = $Coords.Lat
$Lng = $Coords.Lng

if ($Coords.Ok) {
    Write-Host "  OK: Coordenadas obtenidas ($Lat, $Lng)" -ForegroundColor Green
} else {
    Write-Host "  WARN: No se pudo geocodificar la direccion. Se usaran coordenadas por defecto." -ForegroundColor Yellow
    Write-Host "        Podras actualizarlas desde el dashboard." -ForegroundColor Gray
}

# ─── Step 3: Auto-Register in Supabase ────────────────────────────────────────

Write-Host ""
Write-Host "[3/6] Registrando estacion en Supabase..." -ForegroundColor Yellow

# 3a. Register owner email (upsert — won't fail if already exists)
try {
    $emailHeaders = $AUTH_HEADERS.Clone()
    $emailHeaders["Prefer"] = "resolution=merge-duplicates,return=minimal"

    $emailBody = @{ email = $OwnerEmail.ToLower() } | ConvertTo-Json
    $emailBodyBytes = [System.Text.Encoding]::UTF8.GetBytes($emailBody)
    Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/allowed_emails?on_conflict=email" `
        -Method POST -Headers $emailHeaders -Body $emailBodyBytes | Out-Null

    Write-Host "  OK: Email registrado" -ForegroundColor Green
} catch {
    Write-Host "  WARN: No se pudo registrar email (puede que ya exista): $_" -ForegroundColor Yellow
}

# 3b. Check if station already exists (avoid duplicates on reinstall)
$StationUUID = $null
try {
    $encodedName = [uri]::EscapeDataString($StationName)
    $existingStation = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/stations?owner_email=eq.$($OwnerEmail.ToLower())&name=eq.$encodedName&select=id&limit=1" `
        -Method GET -Headers $AUTH_HEADERS

    if ($existingStation -and ($existingStation -is [System.Array]) -and $existingStation.Count -gt 0) {
        $StationUUID = $existingStation[0].id
        Write-Host "  OK: Estacion existente encontrada (UUID: $($StationUUID.Substring(0,8))...)" -ForegroundColor Green
    } elseif ($existingStation -and $existingStation.id) {
        $StationUUID = $existingStation.id
        Write-Host "  OK: Estacion existente encontrada (UUID: $($StationUUID.Substring(0,8))...)" -ForegroundColor Green
    }
} catch {
    Write-Host "  Verificando estacion existente: no encontrada, se creara nueva." -ForegroundColor Gray
}

# 3c. Create station if it doesn't exist
if ([string]::IsNullOrWhiteSpace($StationUUID)) {
    try {
        $stationHeaders = $AUTH_HEADERS.Clone()
        $stationHeaders["Prefer"] = "return=representation"

        $stationBody = @{
            name        = $StationName
            owner_email = $OwnerEmail.ToLower()
            address     = $StationAddress
            coordinates = @($Lat, $Lng)
            is_active   = $true
        } | ConvertTo-Json

        $stationBodyBytes = [System.Text.Encoding]::UTF8.GetBytes($stationBody)
        $response = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/stations" `
            -Method POST -Headers $stationHeaders -Body $stationBodyBytes

        if ($response -is [System.Array]) {
            $StationUUID = $response[0].id
        } else {
            $StationUUID = $response.id
        }

        if ([string]::IsNullOrWhiteSpace($StationUUID)) {
            throw "No se recibio UUID de la estacion"
        }

        Write-Host "  OK: Estacion creada (UUID: $($StationUUID.Substring(0,8))...)" -ForegroundColor Green
    } catch {
        Write-Host "  ERROR: No se pudo crear la estacion: $_" -ForegroundColor Red
        Write-Host "  Verifica la conexion a internet y que el SQL migration fue ejecutado." -ForegroundColor Yellow
        Read-Host "Presiona Enter para cerrar"
        exit 1
    }
}

# ─── Step 4: Copy Files ──────────────────────────────────────────────────────

Write-Host ""
Write-Host "[4/6] Instalando archivos..." -ForegroundColor Yellow

New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null
New-Item -ItemType Directory -Path "$INSTALL_DIR\logs" -Force | Out-Null
New-Item -ItemType Directory -Path "$INSTALL_DIR\logs\dead_letter" -Force | Out-Null

if (-not (Test-Path "C:\SVAPP")) {
    Write-Host "  ERROR: La carpeta C:\SVAPP no existe en esta PC." -ForegroundColor Red
    Write-Host "  Esta carpeta la crea el sistema de la estacion (VB)." -ForegroundColor Yellow
    Write-Host "  Asegurate de instalar este agente en la PC servidor de la estacion." -ForegroundColor Yellow
    Read-Host "Presiona Enter para cerrar"
    exit 1
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Copy-Item "$scriptDir\*.py" $INSTALL_DIR -Force
Copy-Item "$scriptDir\parsers" "$INSTALL_DIR\parsers" -Recurse -Force
Copy-Item "$scriptDir\requirements.txt" $INSTALL_DIR -Force
Copy-Item "$scriptDir\install.bat" $INSTALL_DIR -Force
Copy-Item "$scriptDir\scan.bat" $INSTALL_DIR -Force

Write-Host "  OK: Archivos copiados a $INSTALL_DIR" -ForegroundColor Green

# ─── Step 5: Generate Config Files ────────────────────────────────────────────

Write-Host ""
Write-Host "[5/6] Generando configuracion..." -ForegroundColor Yellow

# .env
$envContent = "SUPABASE_SERVICE_KEY=$SERVICE_KEY"
Set-Content -Path "$INSTALL_DIR\.env" -Value $envContent

# config.yaml
$configContent = @"
# Station-OS Edge Agent Configuration
# Auto-generated by setup.ps1 — $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
# Station: $StationName
# Owner: $OwnerEmail

supabase:
  url: "$SUPABASE_URL"
  service_key_env: "SUPABASE_SERVICE_KEY"

watcher:
  watch_path: 'C:\SVAPP'
  watched_extensions:
    - ".txt"
    - ".TXT"
  debounce_seconds: 2
  max_file_size_bytes: 52428800

station_id: "$StationUUID"

reconciliation:
  cash_variance_tolerance: 0.001

alerts:
  min_tank_liters: 800
  critical_tank_liters: 300

logging:
  level: "INFO"
  log_file: 'logs\edge_agent.log'
  max_bytes: 10485760
  backup_count: 5

retry:
  attempts: 3
  wait_seconds: 5
  dead_letter_path: 'logs\dead_letter\'
"@

Set-Content -Path "$INSTALL_DIR\config.yaml" -Value $configContent

Write-Host "  OK: .env y config.yaml generados" -ForegroundColor Green

# ─── Step 6: Install Dependencies + Service ───────────────────────────────────

Write-Host ""
Write-Host "[6/6] Instalando dependencias y servicio..." -ForegroundColor Yellow

# 6a. Instalar dependencias Python
try {
    Push-Location $INSTALL_DIR
    python -m pip install --upgrade pip -q 2>$null
    python -m pip install -r requirements.txt -q
    Pop-Location
    Write-Host "  OK: Dependencias Python instaladas" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Fallo instalacion de dependencias: $_" -ForegroundColor Red
    Read-Host "Presiona Enter para cerrar"
    exit 1
}

# 6b. Post-instalacion de pywin32 (registra DLLs — requerido para servicios Windows)
try {
    python -m pywin32_postinstall -install 2>$null
    Write-Host "  OK: pywin32 configurado" -ForegroundColor Green
} catch {
    Write-Host "  WARN: pywin32_postinstall fallo: $_" -ForegroundColor Yellow
}

# 6c. Verificacion: probar que el agente puede leer C:\SVAPP
Write-Host "  Verificando configuracion..." -ForegroundColor Gray
Push-Location $INSTALL_DIR
$testResult = python -c "
import sys, os, glob
sys.path.insert(0, '.')
from dotenv import load_dotenv
load_dotenv()
from watcher import _load_config
from pathlib import Path
config = _load_config(Path('config.yaml'))
watch = Path(config['watcher']['watch_path'])
key = os.environ.get(config['supabase']['service_key_env'], '')
txts = glob.glob(str(watch / '*.TXT')) + glob.glob(str(watch / '*.txt'))
print('Config: OK')
print('SVAPP: ' + str(watch) + ' (' + str(len(txts)) + ' archivos TXT)')
print('Supabase key: ' + ('OK' if key else 'FALTA'))
print('VERIFICACION_OK')
" 2>&1
Pop-Location
$testResult | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
if (($testResult -join " ") -notmatch "VERIFICACION_OK") {
    Write-Host "  ERROR: Verificacion fallo. Revisa los mensajes arriba." -ForegroundColor Red
    Read-Host "Presiona Enter para cerrar"
    exit 1
}
Write-Host "  OK: Verificacion completa" -ForegroundColor Green

# 6d. Detener y eliminar servicio anterior si existe
sc.exe stop StationOSEdgeAgent 2>$null | Out-Null
Start-Sleep -Seconds 2
sc.exe delete StationOSEdgeAgent 2>$null | Out-Null
Start-Sleep -Seconds 1

# 6e. Registrar el servicio Windows
try {
    Push-Location $INSTALL_DIR
    python service.py install 2>$null
    Pop-Location
    Write-Host "  OK: Servicio registrado" -ForegroundColor Green
} catch {
    Write-Host "  WARN: No se pudo registrar servicio Windows: $_" -ForegroundColor Yellow
    Write-Host "  Los datos se procesaran con scan.bat en su lugar." -ForegroundColor Yellow
}

# 6f. Configurar arranque automatico y recuperacion ante fallos
sc.exe config StationOSEdgeAgent start= auto 2>$null | Out-Null
sc.exe failure StationOSEdgeAgent reset= 3600 actions= restart/5000/restart/10000/restart/30000 2>$null | Out-Null

# 6g. Iniciar el servicio
Write-Host "  Iniciando servicio..." -ForegroundColor Gray
sc.exe start StationOSEdgeAgent 2>$null | Out-Null
Start-Sleep -Seconds 4

# 6h. Verificar que quedo corriendo
$svcState = sc.exe query StationOSEdgeAgent 2>&1 | Select-String "STATE"
if ($svcState -match "RUNNING") {
    Write-Host "  OK: Servicio corriendo" -ForegroundColor Green
} else {
    Write-Host "  WARN: El servicio no arranco automaticamente." -ForegroundColor Yellow
    # Mostrar el error real del Event Log
    $evtError = Get-EventLog -LogName Application -Source "StationOSEdgeAgent" -Newest 3 -ErrorAction SilentlyContinue
    if (-not $evtError) {
        $evtError = Get-EventLog -LogName Application -Source "Python*" -Newest 3 -ErrorAction SilentlyContinue
    }
    if ($evtError) {
        Write-Host "  Event Log: $($evtError[0].Message)" -ForegroundColor Yellow
    }
    # Mostrar log del agente si existe
    $logFile = "$INSTALL_DIR\logs\edge_agent.log"
    if (Test-Path $logFile) {
        Write-Host "  Ultimas lineas del log:" -ForegroundColor Yellow
        Get-Content $logFile -Tail 5 | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
    }
    Write-Host ""
    Write-Host "  Procesando archivos existentes..." -ForegroundColor Yellow
    Push-Location $INSTALL_DIR
    python -c "
import sys
sys.path.insert(0, '.')
from watcher import main
from pathlib import Path
from threading import Event
import threading
stop = Event()
threading.Timer(60, stop.set).start()
main(config_path=Path('config.yaml'), stop_event=stop)
" 2>&1 | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
    Pop-Location
    Write-Host "  OK: Archivos existentes procesados." -ForegroundColor Green
}

# 6i. Crear tarea programada como red de seguridad (se crea SIEMPRE, no solo si el servicio falla)
Write-Host "  Configurando escaneo de respaldo (06:15, 14:15, 22:15)..." -ForegroundColor Gray
$taskAction = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c cd /d C:\StationOS && python -c `"import sys; sys.path.insert(0,'.'); from watcher import main; from pathlib import Path; from threading import Event; import threading; stop=Event(); threading.Timer(180,stop.set).start(); main(config_path=Path('config.yaml'),stop_event=stop)`"" -WorkingDirectory "C:\StationOS"
$taskTriggers = @(
    New-ScheduledTaskTrigger -Daily -At "06:15"
    New-ScheduledTaskTrigger -Daily -At "14:15"
    New-ScheduledTaskTrigger -Daily -At "22:15"
)
$taskSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd
Register-ScheduledTask -TaskName "StationOS-Scan" -Action $taskAction -Trigger $taskTriggers -Settings $taskSettings -User "SYSTEM" -RunLevel Highest -Force -ErrorAction SilentlyContinue | Out-Null
Write-Host "  OK: Escaneo de respaldo configurado" -ForegroundColor Green

# ─── Final Status ─────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  INSTALACION COMPLETADA" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Estacion:  $StationName" -ForegroundColor White
Write-Host "  Dueno:     $OwnerEmail" -ForegroundColor White
Write-Host "  Direccion: $StationAddress" -ForegroundColor White
if ($Coords.Ok) {
    Write-Host "  Coords:    $Lat, $Lng  (geocodificado OK)" -ForegroundColor White
} else {
    Write-Host "  Coords:    $Lat, $Lng  (por defecto - actualizar desde el dashboard)" -ForegroundColor Yellow
}
Write-Host "  UUID:      $StationUUID" -ForegroundColor White
Write-Host "  Directorio: $INSTALL_DIR" -ForegroundColor White
Write-Host "  Monitorea: C:\SVAPP" -ForegroundColor White
Write-Host ""

# El servicio ya fue verificado en paso 6f — si llegamos aqui, esta corriendo
Write-Host "  SERVICIO: CORRIENDO - monitoreando C:\SVAPP" -ForegroundColor Green
if ($false) {
    Write-Host "  SERVICIO: NO CORRIENDO" -ForegroundColor Yellow
    Write-Host "  Para iniciar: net start StationOSEdgeAgent" -ForegroundColor Gray
    Write-Host "  Para debug: cd C:\StationOS && python service.py debug" -ForegroundColor Gray
}

Write-Host ""
Write-Host "  El dueno puede acceder al dashboard desde cualquier browser." -ForegroundColor Gray
Write-Host "  Los datos se sincronizan automaticamente en tiempo real." -ForegroundColor Gray
Write-Host ""
Read-Host "Presiona Enter para cerrar"
