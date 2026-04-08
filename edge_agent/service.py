from __future__ import annotations

import logging
import sys
import threading
from pathlib import Path

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

_agent_dir_str = str(_AGENT_DIR)
if _agent_dir_str not in sys.path:
    sys.path.insert(0, _agent_dir_str)

logger = logging.getLogger("station_os.service")

SERVICE_NAME         = "StationOSEdgeAgent"
SERVICE_DISPLAY_NAME = "Station-OS Edge Agent"
SERVICE_DESCRIPTION  = "Station-OS Edge Agent — monitorea C:\\SVAPP y sube datos a Supabase."


if _WIN32_AVAILABLE:
    class StationOSService(win32serviceutil.ServiceFramework):
        _svc_name_         = SERVICE_NAME
        _svc_display_name_ = SERVICE_DISPLAY_NAME
        _svc_description_  = SERVICE_DESCRIPTION

        def __init__(self, args: list[str]):
            win32serviceutil.ServiceFramework.__init__(self, args)
            self._scm_stop_event = win32event.CreateEvent(None, 0, 0, None)
            self._stop_event = threading.Event()
            self._watcher_thread: threading.Thread | None = None

        def SvcStop(self) -> None:
            self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
            logger.info("[Service] Stop requested by SCM.")
            self._stop_event.set()
            win32event.SetEvent(self._scm_stop_event)

        def SvcDoRun(self) -> None:
            servicemanager.LogMsg(
                servicemanager.EVENTLOG_INFORMATION_TYPE,
                servicemanager.PYS_SERVICE_STARTED,
                (self._svc_name_, ""),
            )
            logger.info("[Service] %s starting...", SERVICE_DISPLAY_NAME)

            try:
                self._start_watcher()
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

        def _start_watcher(self) -> None:
            from watcher import main as run_watcher

            config_path = _DEFAULT_CONFIG

            def _resilient_watcher() -> None:
                while not self._stop_event.is_set():
                    try:
                        logger.info("[Service] Watcher starting (config=%s)", config_path)
                        run_watcher(config_path=config_path, stop_event=self._stop_event)
                    except Exception as exc:
                        if self._stop_event.is_set():
                            break
                        logger.error("[Service] Watcher crashed: %s. Restarting in 10s...", exc)
                        servicemanager.LogErrorMsg(
                            f"{SERVICE_NAME} watcher crashed: {exc}"
                        )
                        self._stop_event.wait(10)

            self._watcher_thread = threading.Thread(
                target=_resilient_watcher,
                name="WatcherThread",
                daemon=True,
            )
            self._watcher_thread.start()
            logger.info("[Service] Watcher thread started")


def run_debug() -> None:
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


if __name__ == "__main__":
    if not _WIN32_AVAILABLE:
        print(
            "ERROR: pywin32 is not installed or this is not a Windows system.\n"
            "Install with: pip install pywin32"
        )
        sys.exit(1)

    if len(sys.argv) == 1:
        servicemanager.Initialize()
        servicemanager.PrepareToHostSingle(StationOSService)
        servicemanager.StartServiceCtrlDispatcher()
    elif len(sys.argv) >= 2 and sys.argv[1] == "debug":
        run_debug()
    else:
        win32serviceutil.HandleCommandLine(StationOSService)
