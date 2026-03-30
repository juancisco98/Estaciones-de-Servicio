@echo off
:: Station-OS Edge Agent — Windows Service Manager
:: Run this script as Administrator.
::
:: Usage:
::   install.bat install    Register + configure the service
::   install.bat start      Start the service
::   install.bat stop       Stop the service gracefully
::   install.bat restart    Stop then start
::   install.bat status     Show current service status
::   install.bat remove     Unregister the service
::   install.bat debug      Run interactively (no service, Ctrl+C to stop)
::   install.bat logs       Tail the live log file

setlocal
set SERVICE_NAME=StationOSEdgeAgent
set AGENT_DIR=%~dp0
set PYTHON=python
set SERVICE_SCRIPT=%AGENT_DIR%service.py
set LOG_FILE=%AGENT_DIR%logs\edge_agent.log

:: Check for Administrator privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: This script must be run as Administrator.
    echo Right-click install.bat and select "Run as administrator".
    pause
    exit /b 1
)

if "%1"=="" goto :usage
if /i "%1"=="install"   goto :install
if /i "%1"=="start"     goto :start
if /i "%1"=="stop"      goto :stop
if /i "%1"=="restart"   goto :restart
if /i "%1"=="status"    goto :status
if /i "%1"=="remove"    goto :remove
if /i "%1"=="debug"     goto :debug
if /i "%1"=="logs"      goto :logs
goto :usage

:install
    echo [1/4] Installing Station-OS Edge Agent service...
    %PYTHON% "%SERVICE_SCRIPT%" install
    if %errorlevel% neq 0 (
        echo ERROR: Service installation failed. Check Python and pywin32 are installed.
        goto :end
    )

    echo [2/4] Setting service description...
    sc description %SERVICE_NAME% "Station-OS: monitors D:\SVAPP for VB .TXT files and uploads to Supabase."

    echo [3/4] Configuring automatic startup...
    sc config %SERVICE_NAME% start= auto

    echo [4/4] Configuring failure recovery (restart after 60s, up to 3 times)...
    sc failure %SERVICE_NAME% reset= 86400 actions= restart/60000/restart/60000/restart/120000

    echo.
    echo Service installed successfully.
    echo Run:  install.bat start
    goto :end

:start
    echo Starting %SERVICE_NAME%...
    %PYTHON% "%SERVICE_SCRIPT%" start
    if %errorlevel% equ 0 (
        echo Service started. Use "install.bat status" to verify.
    ) else (
        echo ERROR: Failed to start service. Check Event Viewer for details.
    )
    goto :end

:stop
    echo Stopping %SERVICE_NAME%...
    %PYTHON% "%SERVICE_SCRIPT%" stop
    echo Service stopped.
    goto :end

:restart
    echo Restarting %SERVICE_NAME%...
    %PYTHON% "%SERVICE_SCRIPT%" stop
    timeout /t 3 /nobreak >nul
    %PYTHON% "%SERVICE_SCRIPT%" start
    goto :end

:status
    echo Service status:
    sc query %SERVICE_NAME%
    goto :end

:remove
    echo Stopping service before removal...
    %PYTHON% "%SERVICE_SCRIPT%" stop 2>nul
    timeout /t 2 /nobreak >nul
    echo Removing service...
    %PYTHON% "%SERVICE_SCRIPT%" remove
    echo Service removed.
    goto :end

:debug
    echo Running in debug mode (no service). Press Ctrl+C to stop.
    %PYTHON% "%SERVICE_SCRIPT%" debug
    goto :end

:logs
    if not exist "%LOG_FILE%" (
        echo Log file not found: %LOG_FILE%
        echo The service may not have started yet.
        goto :end
    )
    echo Tailing %LOG_FILE% — press Ctrl+C to stop.
    powershell -Command "Get-Content '%LOG_FILE%' -Wait -Tail 50"
    goto :end

:usage
    echo.
    echo Station-OS Edge Agent — Service Manager
    echo ========================================
    echo Usage: install.bat [command]
    echo.
    echo Commands:
    echo   install   Register and configure the Windows Service
    echo   start     Start the service
    echo   stop      Stop the service gracefully
    echo   restart   Stop then start
    echo   status    Show current service status
    echo   remove    Unregister the service
    echo   debug     Run interactively without installing as a service
    echo   logs      Tail the live log file
    echo.
    echo Run as Administrator required for install/start/stop/remove.
    goto :end

:end
    endlocal
