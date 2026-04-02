@echo off
echo.
echo ================================================================
echo   Station-OS - Escaneo manual de C:\SVAPP
echo ================================================================
echo.
echo Procesando archivos TXT existentes...
echo.
cd /d C:\StationOS
python -c "import sys; sys.path.insert(0, '.'); from watcher import main; from pathlib import Path; from threading import Event; import threading; stop = Event(); threading.Timer(30, stop.set).start(); main(config_path=Path('config.yaml'), stop_event=stop)"
echo.
echo ================================================================
echo   Escaneo completo.
echo   Los datos deberian aparecer en el dashboard en segundos.
echo ================================================================
echo.
pause
