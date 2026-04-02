@echo off
echo.
echo ================================================================
echo   Station-OS - Escaneo manual de C:\SVAPP
echo ================================================================
echo.

REM Borrar state.json para forzar re-procesamiento de todos los archivos
if exist "C:\StationOS\state.json" (
    del "C:\StationOS\state.json"
    echo   Estado anterior limpiado. Se re-procesaran todos los archivos.
)

echo   Procesando archivos TXT...
echo.
cd /d C:\StationOS
python -c "import sys; sys.path.insert(0, '.'); from watcher import main; from pathlib import Path; from threading import Event; import threading; stop = Event(); threading.Timer(120, stop.set).start(); main(config_path=Path('config.yaml'), stop_event=stop)"
echo.
echo ================================================================
echo   Escaneo completo.
echo   Los datos deberian aparecer en el dashboard en segundos.
echo ================================================================
echo.
pause
