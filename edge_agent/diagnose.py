"""
Station-OS Edge Agent — Script de diagnostico
Inspecciona archivos T y A en C:\\SVAPP, prueba el parser, y muestra
exactamente que pasa con cada uno.

Uso: python diagnose.py
"""
from __future__ import annotations

import glob
import os
import sys
from pathlib import Path

# Asegurar que importamos los parsers locales
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

SVAPP_PATH = "C:\\SVAPP"
SEPARATOR = "-" * 70


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


def show_file_content(path: str) -> None:
    """Print file content with attempted encodings."""
    print(f"\nArchivo: {path}")
    try:
        size = os.path.getsize(path)
        mtime = os.path.getmtime(path)
        from datetime import datetime
        print(f"Tamano: {size} bytes")
        print(f"Modificado: {datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M:%S')}")
    except OSError as e:
        print(f"ERROR al leer metadata: {e}")
        return

    print("\n--- CONTENIDO (primeras 20 lineas) ---")
    for encoding in ("latin-1", "cp1252", "utf-8"):
        try:
            with open(path, "r", encoding=encoding, errors="strict") as f:
                lines = f.readlines()
            print(f"(decodificado con {encoding})")
            for i, line in enumerate(lines[:20], 1):
                print(f"  {i:2}| {repr(line)}")
            print(f"--- Total lineas en archivo: {len(lines)} ---")
            return
        except UnicodeDecodeError:
            continue
    print("ERROR: no se pudo decodificar con ningun encoding")


def test_parser(parser_class, file_path: str, parser_name: str) -> None:
    """Run parser on a file and show detailed results."""
    print(f"\n--- Ejecutando {parser_name} ---")
    try:
        parser = parser_class(station_id="diagnostic-test-uuid", file_path=file_path)
        result = parser.parse()
        print(f"Lines parsed:   {result.lines_parsed}")
        print(f"Lines OK:       {result.lines_ok}")
        print(f"Records:        {len(result.records)}")
        print(f"Errors:         {len(result.errors)}")
        print(f"Success flag:   {result.success}")

        if result.errors:
            print("\n--- ERRORES ---")
            for i, err in enumerate(result.errors[:10], 1):
                print(f"{i}. {err[:300]}")

        if result.records:
            print("\n--- PRIMER RECORD (campos enviados a Supabase) ---")
            for k, v in result.records[0].items():
                print(f"  {k}: {repr(v)[:150]}")
        else:
            print("\n!!! NINGUN RECORD PRODUCIDO !!!")
            print("    Esto significa que el regex del parser NO matchea el formato del archivo.")
            print("    Pegale ESTE OUTPUT al asistente para que ajuste el regex.")
    except Exception as exc:
        print(f"\n!!! EXCEPCION EN EL PARSER: {type(exc).__name__}: {exc}")
        import traceback
        traceback.print_exc()


def main() -> None:
    header("STATION-OS - DIAGNOSTICO T Y A FILES")

    if not os.path.isdir(SVAPP_PATH):
        print(f"\nERROR: {SVAPP_PATH} no existe en esta PC")
        return

    # === T FILES ===
    section("ARCHIVOS T (Tanques)")
    t_files = sorted(
        glob.glob(os.path.join(SVAPP_PATH, "T*.TXT")) +
        glob.glob(os.path.join(SVAPP_PATH, "T*.txt")),
        key=os.path.getmtime,
        reverse=True,
    )
    print(f"Total encontrados: {len(t_files)}")
    for f in t_files[:10]:
        size = os.path.getsize(f)
        from datetime import datetime
        mtime = datetime.fromtimestamp(os.path.getmtime(f)).strftime('%Y-%m-%d %H:%M')
        print(f"  {os.path.basename(f):30} {size:6} bytes  {mtime}")

    if t_files:
        latest_t = t_files[0]
        show_file_content(latest_t)
        try:
            from parsers.t_parser import TParser
            test_parser(TParser, latest_t, "TParser")
        except ImportError as e:
            print(f"\nERROR al importar TParser: {e}")
    else:
        print("\nNo hay archivos T para diagnosticar.")

    # === A FILES ===
    section("ARCHIVOS A (Caja)")
    a_files = sorted(
        glob.glob(os.path.join(SVAPP_PATH, "A*.TXT")) +
        glob.glob(os.path.join(SVAPP_PATH, "A*.txt")),
        key=os.path.getmtime,
        reverse=True,
    )
    print(f"Total encontrados: {len(a_files)}")
    for f in a_files[:10]:
        size = os.path.getsize(f)
        from datetime import datetime
        mtime = datetime.fromtimestamp(os.path.getmtime(f)).strftime('%Y-%m-%d %H:%M')
        print(f"  {os.path.basename(f):30} {size:6} bytes  {mtime}")

    if a_files:
        latest_a = a_files[0]
        show_file_content(latest_a)
        try:
            from parsers.a_parser import AParser
            test_parser(AParser, latest_a, "AParser")
        except ImportError as e:
            print(f"\nERROR al importar AParser: {e}")
    else:
        print("\nNo hay archivos A para diagnosticar.")

    # === ESTADO DEL EDGE AGENT ===
    section("ESTADO DEL CODIGO INSTALADO")
    install_dir = "C:\\StationOS"
    if os.path.isdir(install_dir):
        print(f"C:\\StationOS existe")
        parsers_dir = os.path.join(install_dir, "parsers")
        if os.path.isdir(parsers_dir):
            print(f"  parsers/ existe")
            for fname in ("t_parser.py", "a_parser.py"):
                fpath = os.path.join(parsers_dir, fname)
                if os.path.isfile(fpath):
                    size = os.path.getsize(fpath)
                    from datetime import datetime
                    mtime = datetime.fromtimestamp(os.path.getmtime(fpath)).strftime('%Y-%m-%d %H:%M')
                    print(f"    {fname}: {size} bytes (modificado {mtime})")

        # Estado de state.json
        state_json = os.path.join(install_dir, "state.json")
        if os.path.isfile(state_json):
            import json
            try:
                with open(state_json, "r") as f:
                    state = json.load(f)
                processed = state.get("processed_files", {})
                print(f"\n  state.json: {len(processed)} archivos registrados")
                # Mostrar archivos T y A en state
                t_in_state = {k: v for k, v in processed.items() if "T" in os.path.basename(k).upper()[:3]}
                a_in_state = {k: v for k, v in processed.items() if os.path.basename(k).upper().startswith("A")}
                print(f"    Archivos T en state.json: {len(t_in_state)}")
                print(f"    Archivos A en state.json: {len(a_in_state)}")
                if t_in_state:
                    print("    Sample T:")
                    for k, v in list(t_in_state.items())[:3]:
                        print(f"      {os.path.basename(k)}: fail_count={v.get('fail_count', 0)}, last_error={v.get('last_error', 'OK')[:80]}")
                if a_in_state:
                    print("    Sample A:")
                    for k, v in list(a_in_state.items())[:3]:
                        print(f"      {os.path.basename(k)}: fail_count={v.get('fail_count', 0)}, last_error={v.get('last_error', 'OK')[:80]}")
            except Exception as e:
                print(f"  state.json no se pudo leer: {e}")
    else:
        print(f"C:\\StationOS NO existe — corre INSTALAR.bat primero")

    # === DEAD LETTER ===
    dl_dir = os.path.join(install_dir, "logs", "dead_letter")
    if os.path.isdir(dl_dir):
        section("DEAD LETTER FILES")
        dl_files = glob.glob(os.path.join(dl_dir, "*.json"))
        print(f"Total dead_letter files: {len(dl_files)}")
        # Buscar T y A dead letters
        t_dl = [f for f in dl_files if os.path.basename(f).upper().startswith("T")]
        a_dl = [f for f in dl_files if os.path.basename(f).upper().startswith("A")]
        print(f"  T dead_letters: {len(t_dl)}")
        print(f"  A dead_letters: {len(a_dl)}")
        for f in (t_dl + a_dl)[:5]:
            print(f"\n  --- {os.path.basename(f)} ---")
            try:
                import json
                with open(f, "r") as fh:
                    data = json.load(fh)
                print(f"    last_error: {data.get('last_error', '(none)')[:300]}")
                errors = data.get("errors", [])
                if errors:
                    print(f"    parse errors ({len(errors)}):")
                    for e in errors[:5]:
                        print(f"      - {str(e)[:200]}")
            except Exception as e:
                print(f"    No se pudo leer: {e}")

    header("DIAGNOSTICO COMPLETO")
    print("\nCopia TODO este output y pegalo en el chat para que el asistente lo analice.")
    print()


if __name__ == "__main__":
    main()
    input("\nPresiona Enter para cerrar...")
