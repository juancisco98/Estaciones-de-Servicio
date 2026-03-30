# Station-OS Edge Agent — Automated Setup
# Run this on the client's server PC to install the edge agent.
# Only 2 questions: owner email + station name. Everything else is automatic.

param(
    [string]$OwnerEmail = "",
    [string]$StationName = ""
)

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
Write-Host "  Station-OS Edge Agent — Instalador Automatico" -ForegroundColor Cyan
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

# ─── Step 2: Ask 2 Questions ──────────────────────────────────────────────────

Write-Host ""
Write-Host "[2/6] Datos de la estacion" -ForegroundColor Yellow

if ([string]::IsNullOrWhiteSpace($OwnerEmail)) {
    $OwnerEmail = Read-Host "  Email del dueno (ej: cliente@gmail.com)"
}
if ([string]::IsNullOrWhiteSpace($StationName)) {
    $StationName = Read-Host "  Nombre de la estacion (ej: Estacion Ruta 5 Lujan)"
}

if ([string]::IsNullOrWhiteSpace($OwnerEmail) -or [string]::IsNullOrWhiteSpace($StationName)) {
    Write-Host "  ERROR: Datos incompletos." -ForegroundColor Red
    exit 1
}

Write-Host "  Dueno: $OwnerEmail" -ForegroundColor Gray
Write-Host "  Estacion: $StationName" -ForegroundColor Gray

# ─── Step 3: Auto-Register in Supabase ────────────────────────────────────────

Write-Host ""
Write-Host "[3/6] Registrando estacion en Supabase..." -ForegroundColor Yellow

# 3a. Register owner email (upsert — won't fail if already exists)
try {
    $emailHeaders = $AUTH_HEADERS.Clone()
    $emailHeaders["Prefer"] = "resolution=merge-duplicates,return=minimal"

    $emailBody = @{ email = $OwnerEmail.ToLower() } | ConvertTo-Json
    Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/allowed_emails?on_conflict=email" `
        -Method POST -Headers $emailHeaders -Body $emailBody | Out-Null

    Write-Host "  OK: Email registrado" -ForegroundColor Green
} catch {
    Write-Host "  WARN: No se pudo registrar email (puede que ya exista): $_" -ForegroundColor Yellow
}

# 3b. Create station and get UUID back
try {
    $stationHeaders = $AUTH_HEADERS.Clone()
    $stationHeaders["Prefer"] = "return=representation"

    $stationBody = @{
        name        = $StationName
        owner_email = $OwnerEmail.ToLower()
        address     = "Por configurar"
        coordinates = @(-34.6037, -58.3816)
        is_active   = $true
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/stations" `
        -Method POST -Headers $stationHeaders -Body $stationBody

    # Response is an array
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
    exit 1
}

# ─── Step 4: Copy Files ──────────────────────────────────────────────────────

Write-Host ""
Write-Host "[4/6] Instalando archivos..." -ForegroundColor Yellow

New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null
New-Item -ItemType Directory -Path "$INSTALL_DIR\logs" -Force | Out-Null
New-Item -ItemType Directory -Path "$INSTALL_DIR\logs\dead_letter" -Force | Out-Null

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Copy-Item "$scriptDir\*.py" $INSTALL_DIR -Force
Copy-Item "$scriptDir\parsers" "$INSTALL_DIR\parsers" -Recurse -Force
Copy-Item "$scriptDir\requirements.txt" $INSTALL_DIR -Force
Copy-Item "$scriptDir\install.bat" $INSTALL_DIR -Force

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
  watch_path: "C:\SVAPP"
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
  log_file: "logs\edge_agent.log"
  max_bytes: 10485760
  backup_count: 5

retry:
  attempts: 3
  wait_seconds: 5
  dead_letter_path: "logs\dead_letter\"
"@

Set-Content -Path "$INSTALL_DIR\config.yaml" -Value $configContent

Write-Host "  OK: .env y config.yaml generados" -ForegroundColor Green

# ─── Step 6: Install Dependencies + Service ───────────────────────────────────

Write-Host ""
Write-Host "[6/6] Instalando dependencias y servicio..." -ForegroundColor Yellow

try {
    Push-Location $INSTALL_DIR
    python -m pip install --upgrade pip -q 2>$null
    python -m pip install -r requirements.txt -q
    Pop-Location
    Write-Host "  OK: Dependencias Python instaladas" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Fallo instalacion de dependencias: $_" -ForegroundColor Red
    exit 1
}

# Install Windows service
try {
    Push-Location $INSTALL_DIR
    cmd /c "install.bat install" 2>$null
    Pop-Location
    Start-Sleep -Seconds 2
    Write-Host "  OK: Servicio Windows instalado" -ForegroundColor Green
} catch {
    Write-Host "  WARN: Error instalando servicio: $_" -ForegroundColor Yellow
}

# Start the service
try {
    cmd /c "sc start StationOSEdgeAgent" 2>$null | Out-Null
    Start-Sleep -Seconds 3
} catch {}

# ─── Final Status ─────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  INSTALACION COMPLETADA" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Estacion:  $StationName" -ForegroundColor White
Write-Host "  Dueno:     $OwnerEmail" -ForegroundColor White
Write-Host "  UUID:      $StationUUID" -ForegroundColor White
Write-Host "  Directorio: $INSTALL_DIR" -ForegroundColor White
Write-Host "  Monitorea: C:\SVAPP" -ForegroundColor White
Write-Host ""

# Check service status
$svcStatus = cmd /c "sc query StationOSEdgeAgent" 2>&1 | Select-String "STATE"
if ($svcStatus -match "RUNNING") {
    Write-Host "  SERVICIO: CORRIENDO" -ForegroundColor Green
} else {
    Write-Host "  SERVICIO: NO CORRIENDO" -ForegroundColor Yellow
    Write-Host "  Para iniciar: net start StationOSEdgeAgent" -ForegroundColor Gray
    Write-Host "  Para debug: cd C:\StationOS && python service.py debug" -ForegroundColor Gray
}

Write-Host ""
Write-Host "  El dueno puede acceder al dashboard desde cualquier browser." -ForegroundColor Gray
Write-Host "  Los datos se sincronizan automaticamente en tiempo real." -ForegroundColor Gray
Write-Host ""
Read-Host "Presiona Enter para cerrar"
