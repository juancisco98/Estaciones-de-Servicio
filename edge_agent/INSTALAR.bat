@echo off
REM Station-OS Edge Agent - Instalador automatico
REM Hace doble click y se instala todo solo

REM ============================================================
REM PASO 1: Verificar permisos de Administrador
REM ============================================================
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Solicitando permisos de Administrador...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

REM ============================================================
REM PASO 2: Ir a la carpeta del script
REM ============================================================
cd /d "%~dp0"

REM Verificar que setup.ps1 existe
if not exist "setup.ps1" (
    echo.
    echo ERROR: No se encuentra setup.ps1 en esta carpeta.
    echo        Asegurate de copiar la carpeta edge_agent completa.
    echo.
    pause
    exit /b 1
)

REM ============================================================
REM PASO 3: Quitar "Mark of the Web" de todos los archivos
REM Esto evita que SmartScreen bloquee scripts del pendrive
REM ============================================================
echo Desbloqueando archivos del pendrive...
powershell -NoProfile -Command "Get-ChildItem -Path '%~dp0' -Recurse -File | Unblock-File -ErrorAction SilentlyContinue" 2>nul

REM ============================================================
REM PASO 4: Forzar ExecutionPolicy a nivel LocalMachine
REM Esto cubre casos donde GPO tiene scripts deshabilitados
REM ============================================================
echo Configurando politica de ejecucion...
powershell -NoProfile -Command "Set-ExecutionPolicy -Scope LocalMachine -ExecutionPolicy RemoteSigned -Force" 2>nul
powershell -NoProfile -Command "Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force" 2>nul

REM ============================================================
REM PASO 5: Ejecutar el instalador PowerShell
REM ============================================================
echo.
echo ================================================================
echo   Iniciando instalador Station-OS...
echo ================================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"

REM ============================================================
REM PASO 6: Mantener la ventana abierta
REM ============================================================
echo.
echo ================================================================
echo   Proceso finalizado. Presiona cualquier tecla para cerrar.
echo ================================================================
pause >nul
