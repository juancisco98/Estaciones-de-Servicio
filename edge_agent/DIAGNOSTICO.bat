@echo off
REM Station-OS Edge Agent - Diagnostico de archivos T y A
REM Hace doble click para ver exactamente que pasa con los T y A files

cd /d "%~dp0"

echo.
echo ================================================================
echo   STATION-OS - DIAGNOSTICO T Y A FILES
echo ================================================================
echo.
echo Este script va a:
echo   1. Listar todos los T y A files en C:\SVAPP
echo   2. Mostrar el contenido del mas reciente
echo   3. Probar el parser y mostrar errores
echo   4. Verificar estado del codigo instalado
echo   5. Revisar dead_letter files si existen
echo.
echo Espera unos segundos...
echo.

REM Verificar Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python no encontrado en PATH
    echo Corre INSTALAR.bat primero
    pause
    exit /b 1
)

REM Si C:\StationOS existe, usar los parsers de ahi (codigo en produccion)
REM Si no, usar los locales (carpeta del pendrive)
if exist "C:\StationOS\parsers\t_parser.py" (
    echo Usando parsers instalados en C:\StationOS
    cd /d "C:\StationOS"
) else (
    echo Usando parsers locales del pendrive
)

python "%~dp0diagnose.py" 2>&1

echo.
pause
