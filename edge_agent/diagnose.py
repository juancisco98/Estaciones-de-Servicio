"""
Station-OS Edge Agent — Script de diagnostico COMPLETO
Inspecciona TODOS los tipos de archivo (VE, P, S, T, C, A) en C:\\SVAPP,
prueba cada parser, y muestra exactamente que pasa con cada uno.

Uso: python diagnose.py
"""
from __future__ import annotations

import glob
import json
import os
import sys
from datetime import datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

SVAPP_PATH = "C:\\SVAPP"
INSTALL_DIR = "C:\\StationOS"
SEPARATOR = "-" * 70

FILE_TYPES = [
    ("VE", "Ventas (sales transactions)",     "parsers.ve_parser",    "VEParser"),
    ("P",  "Playa (forecourt totals)",        "parsers.p_parser",     "PParser"),
    ("S",  "Salon (shop totals)",             "parsers.s_parser",     "SParser"),
    ("T",  "Tanques (tank levels)",           "parsers.t_parser",     "TParser"),
    ("C",  "Cuentas Corrientes (cards)",      "parsers.c_parser",     "CParser"),
    ("A",  "Caja (cash closings)",            "parsers.a_parser",     "AParser"),
    ("RP", "Rubro Playa (category sales)",    "parsers.rubro_parser", "RubroParser"),
    ("RS", "Rubro Salon (category sales)",    "parsers.rubro_parser", "RubroParser"),
]


def header(msg: str) -> None:
    print()
    print("=" * 70)
    print(f"  {msg}")
    print("=" * 70)


def section(msg: str) -> None:
    print()
    print(SEPARATOR)
    print(f">>> {msg}")
    print(SEPARATOR)


def show_file_content(path: str, max_lines: int = 20) -> None:
    try:
        size = os.path.getsize(path)
        mtime = os.path.getmtime(path)
        print(f"  Tamano: {size} bytes")
        print(f"  Modificado: {datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M:%S')}")
    except OSError as e:
        print(f"  ERROR al leer metadata: {e}")
        return

    print(f"\n  --- CONTENIDO (primeras {max_lines} lineas) ---")
    for encoding in ("latin-1", "cp1252", "utf-8"):
        try:
            with open(path, "r", encoding=encoding, errors="strict") as f:
                lines = f.readlines()
            print(f"  (decodificado con {encoding})")
            for i, line in enumerate(lines[:max_lines], 1):
                print(f"    {i:2}| {repr(line)}")
            print(f"  --- Total lineas en archivo: {len(lines)} ---")
            return
        except UnicodeDecodeError:
            continue
    print("  ERROR: no se pudo decodificar con ningun encoding")


def test_parser(parser_class, file_path: str, parser_name: str) -> dict:
    """Run parser on a file and show detailed results. Returns summary dict."""
    print(f"\n  --- Ejecutando {parser_name} ---")
    summary = {"parser": parser_name, "file": os.path.basename(file_path)}
    try:
        parser = parser_class(station_id="diagnostic-test-uuid", file_path=file_path)
        result = parser.parse()
        summary["lines_parsed"] = result.lines_parsed
        summary["lines_ok"] = result.lines_ok
        summary["records"] = len(result.records)
        summary["errors"] = len(result.errors)
        summary["success"] = result.success

        print(f"  Lines parsed:   {result.lines_parsed}")
        print(f"  Lines OK:       {result.lines_ok}")
        print(f"  Records:        {len(result.records)}")
        print(f"  Errors:         {len(result.errors)}")
        print(f"  Success flag:   {result.success}")

        if result.errors:
            print(f"\n  --- ERRORES ({len(result.errors)}) ---")
            for i, err in enumerate(result.errors[:10], 1):
                print(f"  {i}. {err[:300]}")
            if len(result.errors) > 10:
                print(f"  ... y {len(result.errors) - 10} errores mas")

        if result.records:
            print("\n  --- PRIMER RECORD (campos enviados a Supabase) ---")
            for k, v in result.records[0].items():
                print(f"    {k}: {repr(v)[:150]}")
        else:
            print("\n  !!! NINGUN RECORD PRODUCIDO !!!")
            print("      El regex del parser NO matchea el formato del archivo.")
            print("      Pegale ESTE OUTPUT al asistente para que ajuste el regex.")
    except Exception as exc:
        summary["exception"] = str(exc)
        print(f"\n  !!! EXCEPCION EN EL PARSER: {type(exc).__name__}: {exc}")
        import traceback
        traceback.print_exc()

    return summary


def find_files(prefix: str) -> list[str]:
    """Find files matching a prefix in SVAPP, sorted by mtime descending."""
    if prefix == "T":
        patterns = [
            os.path.join(SVAPP_PATH, "T*.TXT"),
            os.path.join(SVAPP_PATH, "T*.txt"),
            os.path.join(SVAPP_PATH, "TQ*.TXT"),
            os.path.join(SVAPP_PATH, "TQ*.txt"),
        ]
    else:
        patterns = [
            os.path.join(SVAPP_PATH, f"{prefix}*.TXT"),
            os.path.join(SVAPP_PATH, f"{prefix}*.txt"),
        ]

    files = set()
    for pat in patterns:
        files.update(glob.glob(pat))

    # Excluir archivos que matchean un prefijo mas largo
    # (ej: VE files no deben incluirse en V files)
    longer_prefixes = {"V": "VE", "T": "TQ"}
    if prefix in longer_prefixes:
        pass  # T files include TQ, VE is its own prefix — no filtering needed

    return sorted(files, key=os.path.getmtime, reverse=True)


def diagnose_file_type(prefix: str, description: str, module_name: str, class_name: str) -> dict:
    """Diagnose a single file type. Returns summary."""
    section(f"ARCHIVOS {prefix} ({description})")

    files = find_files(prefix)
    print(f"Total encontrados: {len(files)}")

    if not files:
        print(f"\n  No hay archivos {prefix} en {SVAPP_PATH}")
        return {"prefix": prefix, "total_files": 0, "status": "NO_FILES"}

    for f in files[:5]:
        try:
            size = os.path.getsize(f)
            mtime = datetime.fromtimestamp(os.path.getmtime(f)).strftime('%Y-%m-%d %H:%M')
            print(f"  {os.path.basename(f):30} {size:6} bytes  {mtime}")
        except OSError:
            print(f"  {os.path.basename(f):30} (no se pudo leer)")
    if len(files) > 5:
        print(f"  ... y {len(files) - 5} archivos mas")

    latest = files[0]
    print(f"\n  Archivo mas reciente: {os.path.basename(latest)}")
    show_file_content(latest)

    summary = {"prefix": prefix, "total_files": len(files), "latest": os.path.basename(latest)}

    try:
        mod = __import__(module_name, fromlist=[class_name])
        parser_class = getattr(mod, class_name)
        parse_result = test_parser(parser_class, latest, class_name)
        summary.update(parse_result)
    except ImportError as e:
        print(f"\n  ERROR al importar {class_name}: {e}")
        summary["status"] = f"IMPORT_ERROR: {e}"

    return summary


def show_state_json() -> None:
    section("ESTADO DE state.json")
    state_json = os.path.join(INSTALL_DIR, "state.json")
    if not os.path.isfile(state_json):
        print("  state.json NO EXISTE — el edge agent no ha procesado nada aun")
        return

    try:
        with open(state_json, "r") as f:
            state = json.load(f)
    except Exception as e:
        print(f"  state.json no se pudo leer: {e}")
        return

    processed = state.get("processed_files", {})
    print(f"  Total archivos en state.json: {len(processed)}")

    # Agrupar por tipo
    by_type: dict[str, list] = {}
    for fpath, entry in processed.items():
        name = os.path.basename(fpath).upper()
        if name.startswith("VE"):
            t = "VE"
        elif name.startswith("TQ") or (name.startswith("T") and not name.startswith("TQ")):
            t = "T"
        elif name.startswith("C"):
            t = "C"
        elif name.startswith("P"):
            t = "P"
        elif name.startswith("S"):
            t = "S"
        elif name.startswith("A"):
            t = "A"
        else:
            t = "OTHER"
        by_type.setdefault(t, []).append((fpath, entry))

    for t in ("VE", "P", "S", "T", "C", "A", "OTHER"):
        entries = by_type.get(t, [])
        if not entries:
            continue
        failed = [e for e in entries if "fail_count" in e[1]]
        zero_records = [e for e in entries if e[1].get("records_inserted", -1) == 0 and "fail_count" not in e[1]]
        ok = [e for e in entries if e[1].get("records_inserted", 0) > 0]
        print(f"\n  {t}: {len(entries)} total | {len(ok)} OK | {len(zero_records)} con 0 records | {len(failed)} fallidos")

        # Mostrar los problemáticos
        for fpath, entry in (zero_records + failed)[:3]:
            status = "FAILED" if "fail_count" in entry else "0_RECORDS"
            fc = entry.get("fail_count", "")
            err = entry.get("last_error", "")[:100]
            rec = entry.get("records_inserted", "?")
            print(f"    [{status}] {os.path.basename(fpath)}: records={rec} fail_count={fc}")
            if err:
                print(f"             error: {err}")


def show_dead_letters() -> None:
    dl_dir = os.path.join(INSTALL_DIR, "logs", "dead_letter")
    if not os.path.isdir(dl_dir):
        return

    section("DEAD LETTER FILES")
    dl_files = glob.glob(os.path.join(dl_dir, "*.json"))
    print(f"  Total dead_letter files: {len(dl_files)}")

    if not dl_files:
        return

    for f in sorted(dl_files, key=os.path.getmtime, reverse=True)[:10]:
        print(f"\n  --- {os.path.basename(f)} ---")
        try:
            with open(f, "r") as fh:
                data = json.load(fh)
            print(f"    last_error: {data.get('last_error', '(none)')[:300]}")
            errors = data.get("errors", [])
            if errors:
                print(f"    parse errors ({len(errors)}):")
                for e in errors[:3]:
                    print(f"      - {str(e)[:200]}")
        except Exception as e:
            print(f"    No se pudo leer: {e}")


def show_recent_log() -> None:
    log_path = os.path.join(INSTALL_DIR, "logs", "edge_agent.log")
    if not os.path.isfile(log_path):
        return

    section("ULTIMAS 50 LINEAS DEL LOG")
    try:
        with open(log_path, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()
        for line in lines[-50:]:
            print(f"  {line.rstrip()}")
    except Exception as e:
        print(f"  No se pudo leer el log: {e}")


def show_installed_code() -> None:
    section("ESTADO DEL CODIGO INSTALADO")
    if not os.path.isdir(INSTALL_DIR):
        print(f"  {INSTALL_DIR} NO existe — corre setup.ps1 primero")
        return

    print(f"  {INSTALL_DIR} existe")
    parsers_dir = os.path.join(INSTALL_DIR, "parsers")
    if os.path.isdir(parsers_dir):
        print(f"  parsers/ existe")
        for fname in sorted(os.listdir(parsers_dir)):
            if fname.endswith(".py"):
                fpath = os.path.join(parsers_dir, fname)
                size = os.path.getsize(fpath)
                mtime = datetime.fromtimestamp(os.path.getmtime(fpath)).strftime('%Y-%m-%d %H:%M')
                print(f"    {fname}: {size} bytes (modificado {mtime})")
    else:
        print(f"  parsers/ NO EXISTE — la instalacion esta incompleta")


def main() -> None:
    header("STATION-OS - DIAGNOSTICO COMPLETO")
    print(f"Fecha/Hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Directorio SVAPP: {SVAPP_PATH}")
    print(f"Directorio instalacion: {INSTALL_DIR}")

    if not os.path.isdir(SVAPP_PATH):
        print(f"\nERROR: {SVAPP_PATH} no existe en esta PC")
        return

    # Diagnosticar cada tipo de archivo
    summaries = []
    for prefix, description, module_name, class_name in FILE_TYPES:
        summary = diagnose_file_type(prefix, description, module_name, class_name)
        summaries.append(summary)

    # Estado del edge agent
    show_installed_code()
    show_state_json()
    show_dead_letters()
    show_recent_log()

    # Resumen final
    header("RESUMEN")
    print(f"\n  {'TIPO':<6} {'ARCHIVOS':<10} {'RECORDS':<10} {'ERRORS':<10} {'ESTADO'}")
    print(f"  {'-'*6} {'-'*10} {'-'*10} {'-'*10} {'-'*20}")
    for s in summaries:
        prefix = s.get("prefix", "?")
        total = s.get("total_files", 0)
        records = s.get("records", "-")
        errors = s.get("errors", "-")
        if total == 0:
            status = "SIN ARCHIVOS"
        elif s.get("exception"):
            status = "EXCEPCION"
        elif records == 0 and errors and int(errors) > 0:
            status = "REGEX NO MATCHEA"
        elif records and int(str(records)) > 0:
            status = "OK"
        else:
            status = "REVISAR"
        print(f"  {prefix:<6} {total:<10} {records!s:<10} {errors!s:<10} {status}")

    print()
    print("  Copia TODO este output y pegalo en el chat para que el asistente")
    print("  pueda diagnosticar el problema exacto.")
    print()


if __name__ == "__main__":
    main()
    input("\nPresiona Enter para cerrar...")
