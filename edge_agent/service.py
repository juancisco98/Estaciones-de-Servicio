"""
Station-OS Edge Agent — Windows Service Wrapper

Installs and runs the edge agent watcher as a persistent Windows Service
using pywin32. The service starts automatically on Windows boot and restarts
on failure (configured via the SC failure actions set in install.bat).

Usage (run as Administrator):
    python service.py install    # Register the service
    python service.py start      # Start it
    python service.py stop       # Stop gracefully
    python service.py restart    # Stop + start
    python service.py remove     # Unregister the service
    python service.py debug      # Run interactively (no service, Ctrl+C to stop)

Requirements:
    pip install pywin32
    (already in edge_agent/requirements.txt)

Architecture:
    SvcDoRun()
        ↓ spawns daemon thread
    watcher.main(config_path, stop_event)
        ↓ watchdog Observer monitors D:\\SVAPP
    (blocking — stop_event.wait())
    SvcStop() → sets stop_event → thread exits → service stops
"""

from __future__ import annotations

import logging
import sys
import threading
from pathlib import Path

# Guard: pywin32 is Windows-only. Allow importing this module on other platforms
# without crashing (useful for linting / CI on Linux).
try:
    import win32event
    import win32service
    import win32serviceutil
    import servicemanager
    _WIN32_AVAILABLE = True
except ImportError:
    _WIN32_AVAILABLE = False

_AGENT_DIR = Path(__file__).parent
_DEFAULT_CONFIG = _AGENT_DIR / "config.yaml"

# Asegurar que el directorio del agente esta en sys.path.
# Cuando Windows ejecuta el servicio, el CWD es C:\Windows\System32
# y las importaciones relativas fallan. Esto permite usar imports absolutos.
_agent_dir_str = str(_AGENT_DIR)
if _agent_dir_str not in sys.path:
    sys.path.insert(0, _agent_dir_str)

logger = logging.getLogger("station_os.service")

# ── Service constants ─────────────────────────────────────────────────────────

SERVICE_NAME         = "StationOSEdgeAgent"
SERVICE_DISPLAY_NAME = "Station-OS Edge Agent"
SERVICE_DESCRIPTION  = (
    "Monitors D:\\SVAPP\\<station_code>\\ for .TXT files written by the legacy "
    "Visual Basic POS system and uploads parsed records to Supabase in real time. "
    "Part of the Station-OS network intelligence platform."
)


# ── Windows Service class ─────────────────────────────────────────────────────

if _WIN32_AVAILABLE:
    class StationOSService(win32serviceutil.ServiceFramework):
        _svc_name_         = SERVICE_NAME
        _svc_display_name_ = SERVICE_DISPLAY_NAME
        _svc_description_  = SERVICE_DESCRIPTION

        def __init__(self, args: list[str]):
            win32serviceutil.ServiceFramework.__init__(self, args)
            # Event used by Windows SCM to signal stop
            self._scm_stop_event = win32event.CreateEvent(None, 0, 0, None)
            # Python threading.Event passed to watcher.main() for graceful shutdown
            self._stop_event = threading.Event()
            self._watcher_thread: threading.Thread | None = None

        # ── SCM callbacks ─────────────────────────────────────────────────────

        def SvcStop(self) -> None:
            """Called by Windows SCM when the service is requested to stop."""
            self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
            logger.info("[Service] Stop requested by SCM.")
            # Signal the watcher loop to exit
            self._stop_event.set()
            # Signal the SCM wait handle so SvcDoRun() unblocks
            win32event.SetEvent(self._scm_stop_event)

        def SvcDoRun(self) -> None:
            """
            Called by Windows SCM when the service starts.
            Runs until SvcStop() is called.
            """
            servicemanager.LogMsg(
                servicemanager.EVENTLOG_INFORMATION_TYPE,
                servicemanager.PYS_SERVICE_STARTED,
                (self._svc_name_, ""),
            )
            logger.info("[Service] %s starting...", SERVICE_DISPLAY_NAME)

            try:
                self._start_watcher()
                # Block until the SCM signals stop
                win32event.WaitForSingleObject(
                    self._scm_stop_event, win32event.INFINITE
                )
            except Exception as exc:
                logger.exception("[Service] Fatal error in SvcDoRun: %s", exc)
                servicemanager.LogErrorMsg(f"{SERVICE_NAME} crashed: {exc}")
            finally:
                self._stop_event.set()
                if self._watcher_thread and self._watcher_thread.is_alive():
                    self._watcher_thread.join(timeout=15)
                logger.info("[Service] %s stopped.", SERVICE_DISPLAY_NAME)
                servicemanager.LogMsg(
                    servicemanager.EVENTLOG_INFORMATION_TYPE,
                    servicemanager.PYS_SERVICE_STOPPED,
                    (self._svc_name_, ""),
                )

        # ── Internal ──────────────────────────────────────────────────────────

        def _start_watcher(self) -> None:
            """Start watcher.main() in a daemon thread."""
            from watcher import main as run_watcher

            config_path = _DEFAULT_CONFIG

            self._watcher_thread = threading.Thread(
                target=run_watcher,
                kwargs={
                    "config_path": config_path,
                    "stop_event":  self._stop_event,
                },
                name="WatcherThread",
                daemon=True,
            )
            self._watcher_thread.start()
            logger.info(
                "[Service] Watcher thread started (config=%s)", config_path
            )


# ── Debug mode (no service, interactive) ─────────────────────────────────────

def run_debug() -> None:
    """
    Run the watcher interactively (without installing as a service).
    Useful for testing on Windows without elevated permissions.
    Press Ctrl+C to stop.
    """
    import logging
    from watcher import _setup_logging, _load_config, main as run_watcher

    config = _load_config(_DEFAULT_CONFIG)
    _setup_logging(config)
    logger.info("[Debug] Running in debug mode. Press Ctrl+C to stop.")

    stop_event = threading.Event()
    try:
        run_watcher(config_path=_DEFAULT_CONFIG, stop_event=stop_event)
    except KeyboardInterrupt:
        logger.info("[Debug] Interrupted.")
        stop_event.set()


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if not _WIN32_AVAILABLE:
        print(
            "ERROR: pywin32 is not installed or this is not a Windows system.\n"
            "Install with: pip install pywin32\n"
            "For non-Windows development, use: python watcher.py"
        )
        sys.exit(1)

    if len(sys.argv) == 1:
        # Called by the Windows SCM with no arguments — run the service dispatcher
        servicemanager.Initialize()
        servicemanager.PrepareToHostSingle(StationOSService)
        servicemanager.StartServiceCtrlDispatcher()
    elif len(sys.argv) >= 2 and sys.argv[1] == "debug":
        run_debug()
    else:
        # Delegate install / start / stop / remove / restart to pywin32 helper
        win32serviceutil.HandleCommandLine(StationOSService)
