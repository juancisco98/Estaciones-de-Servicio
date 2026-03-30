# Station-OS Edge Agent Setup Script
# Run this script as Administrator on the server PC to install the edge agent
# The agent monitors C:\SVAPP for .TXT files and uploads data to Supabase

param(
    [string]$StationName = "",
    [string]$StationCode = "",
    [string]$StationUUID = ""
)

# ─── Configuration ────────────────────────────────────────────────────────────

$INSTALL_DIR = "C:\StationOS"
$SUPABASE_URL = "https://cmbafysulwyskxzhclhm.supabase.co"
$SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNtYmFmeXN1bHd5c2t4emhjbGhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDg5NzUxMiwiZXhwIjoyMDkwNDczNTEyfQ.Vfb0q2PBVK70ZXsocgJK0MF2crIYKAgSNvEEEKKHDAw"

Write-Host "════════════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Station-OS Edge Agent Setup" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# ─── Check Administrator ──────────────────────────────────────────────────────

$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "⚠ Este script requiere permisos de Administrador" -ForegroundColor Yellow
    Write-Host "Reiniciando como Administrador..." -ForegroundColor Yellow
    Start-Process PowerShell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

# ─── Check Python 3.11+ ───────────────────────────────────────────────────────

Write-Host "[1/6] Verificando Python 3.11+..." -ForegroundColor Yellow

$pythonVersion = python --version 2>&1
if ($LASTEXITCODE -ne 0 -or $pythonVersion -notmatch "3\.(1[1-9]|[2-9]\d)") {
    Write-Host "❌ Python 3.11+ no instalado" -ForegroundColor Red
    Write-Host "Instalando Python 3.11 vía winget..." -ForegroundColor Yellow

    try {
        winget install -e --id Python.Python.3.11 --accept-package-agreements --accept-source-agreements

        if ($LASTEXITCODE -ne 0) {
            Write-Host "⚠ winget falló, intenta manualmente: https://www.python.org/downloads/" -ForegroundColor Yellow
            Read-Host "Presiona Enter después de instalar Python"
        }
    } catch {
        Write-Host "⚠ Error con winget. Descargá Python desde https://www.python.org/downloads/" -ForegroundColor Yellow
        Read-Host "Presiona Enter después de instalar Python"
    }
}

$pythonVersion = python --version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Python instalado: $pythonVersion" -ForegroundColor Green
} else {
    Write-Host "❌ Python no se pudo instalar. Saliendo." -ForegroundColor Red
    exit 1
}

# ─── Request User Input ───────────────────────────────────────────────────────

Write-Host ""
Write-Host "[2/6] Configuración" -ForegroundColor Yellow

if ([string]::IsNullOrWhiteSpace($StationName)) {
    $StationName = Read-Host "Nombre de la estación (ej: Estación Ruta 5 Luján)"
}

if ([string]::IsNullOrWhiteSpace($StationCode)) {
    $StationCode = Read-Host "Código de estación (ej: EST_001, debe coincidir con carpeta en C:\SVAPP)"
}

if ([string]::IsNullOrWhiteSpace($StationUUID)) {
    $StationUUID = Read-Host "UUID de la estación (copiar desde Supabase → tabla stations)"
}

if ([string]::IsNullOrWhiteSpace($StationName) -or [string]::IsNullOrWhiteSpace($StationCode) -or [string]::IsNullOrWhiteSpace($StationUUID)) {
    Write-Host "❌ Datos incompletos. Saliendo." -ForegroundColor Red
    exit 1
}

Write-Host "✓ Configuración:" -ForegroundColor Green
Write-Host "  Estación: $StationName"
Write-Host "  Código: $StationCode"
Write-Host "  UUID: $StationUUID"
Write-Host "  URL Supabase: $SUPABASE_URL"

# ─── Create Installation Directory ────────────────────────────────────────────

Write-Host ""
Write-Host "[3/6] Creando directorio de instalación..." -ForegroundColor Yellow

if (Test-Path $INSTALL_DIR) {
    Write-Host "⚠ Directorio $INSTALL_DIR ya existe. Se sobrescribirá." -ForegroundColor Yellow
}

New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null
Write-Host "✓ Directorio creado: $INSTALL_DIR" -ForegroundColor Green

# ─── Copy Edge Agent Files ────────────────────────────────────────────────────

Write-Host ""
Write-Host "[4/6] Copiando archivos del edge agent..." -ForegroundColor Yellow

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Copy all Python files
Copy-Item "$scriptDir\*.py" $INSTALL_DIR -Force
Copy-Item "$scriptDir\parsers" $INSTALL_DIR -Recurse -Force
Copy-Item "$scriptDir\requirements.txt" $INSTALL_DIR -Force
Copy-Item "$scriptDir\install.bat" $INSTALL_DIR -Force
Copy-Item "$scriptDir\config.yaml" $INSTALL_DIR -Force

Write-Host "✓ Archivos copiados a $INSTALL_DIR" -ForegroundColor Green

# ─── Create .env File ─────────────────────────────────────────────────────────

Write-Host ""
Write-Host "[5/6] Generando archivo .env..." -ForegroundColor Yellow

$envContent = @"
SUPABASE_SERVICE_KEY=$SERVICE_KEY
"@

$envPath = "$INSTALL_DIR\.env"
Set-Content -Path $envPath -Value $envContent
Write-Host "✓ .env creado: $envPath" -ForegroundColor Green

# ─── Create config.yaml ───────────────────────────────────────────────────────

Write-Host ""
Write-Host "[5/6] Generando archivo config.yaml..." -ForegroundColor Yellow

$configContent = @"
# Station-OS Edge Agent Configuration
# Generated by setup.ps1 — $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

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

stations:
  $StationCode: "$StationUUID"

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

$configPath = "$INSTALL_DIR\config.yaml"
Set-Content -Path $configPath -Value $configContent
Write-Host "✓ config.yaml creado: $configPath" -ForegroundColor Green

# ─── Install Python Dependencies ──────────────────────────────────────────────

Write-Host ""
Write-Host "[6/6] Instalando dependencias Python..." -ForegroundColor Yellow

try {
    Push-Location $INSTALL_DIR
    python -m pip install --upgrade pip -q
    python -m pip install -r requirements.txt -q
    Pop-Location
    Write-Host "✓ Dependencias instaladas" -ForegroundColor Green
} catch {
    Write-Host "❌ Error instalando dependencias: $_" -ForegroundColor Red
    exit 1
}

# ─── Install and Start Windows Service ────────────────────────────────────────

Write-Host ""
Write-Host "[Instalando servicio Windows...]" -ForegroundColor Yellow

try {
    Push-Location $INSTALL_DIR
    cmd /c "install.bat install"
    Pop-Location
    Start-Sleep -Seconds 2
    Write-Host "✓ Servicio instalado" -ForegroundColor Green
} catch {
    Write-Host "⚠ Error instalando servicio: $_" -ForegroundColor Yellow
}

try {
    cmd /c "sc start StationOSEdgeAgent" *>$null
    Start-Sleep -Seconds 2
    Write-Host "✓ Servicio iniciado" -ForegroundColor Green
} catch {
    Write-Host "⚠ Error iniciando servicio: $_" -ForegroundColor Yellow
}

# ─── Verify Installation ─────────────────────────────────────────────────────

Write-Host ""
Write-Host "════════════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "INSTALACIÓN COMPLETADA" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan

Write-Host ""
Write-Host "📁 Directorio de instalación: $INSTALL_DIR" -ForegroundColor White
Write-Host "🔧 Estación: $StationName ($StationCode)" -ForegroundColor White
Write-Host "📡 Monitoreando: C:\SVAPP\$StationCode" -ForegroundColor White

Write-Host ""
Write-Host "Verificando estado del servicio..." -ForegroundColor Yellow
$serviceStatus = cmd /c "sc query StationOSEdgeAgent" 2>&1 | Select-String "STATE"

if ($serviceStatus -match "RUNNING") {
    Write-Host "✓ Servicio CORRIENDO" -ForegroundColor Green
} else {
    Write-Host "⚠ Servicio NO CORRIENDO" -ForegroundColor Yellow
    Write-Host "Prueba manualmente: net start StationOSEdgeAgent" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Ver logs:" -ForegroundColor Cyan
Write-Host "  Get-Content 'C:\StationOS\logs\edge_agent.log' -Wait -Tail 50" -ForegroundColor Gray

Write-Host ""
Write-Host "Desinstalar servicio:" -ForegroundColor Cyan
Write-Host "  cd C:\StationOS && install.bat remove" -ForegroundColor Gray

Write-Host ""
Read-Host "Presiona Enter para cerrar"
