@echo off
REM Station-OS Edge Agent Setup Launcher
REM Double-click this file to start the installation wizard

setlocal enabledelayedexpansion

REM Get the directory where this script is located
set SCRIPT_DIR=%~dp0
set SETUP_PS1=%SCRIPT_DIR%setup.ps1

REM Launch PowerShell setup script with elevated privileges
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "& {Start-Process PowerShell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%SETUP_PS1%\"' -Verb RunAs}"

endlocal
