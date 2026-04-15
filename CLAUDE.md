# Station-OS: Central Intelligence for Gas Station Network

## 1. Core Identity & Purpose
You are the **Central Operational Brain** for a network of 60 gas stations. Your mission is to process, audit, and learn from raw data extracted from legacy Visual Basic systems in `.txt` format. You are not just a parser; you are a **Preventive Auditor** designed to detect fraud, operational errors, and consumer trends across the entire fleet.

---

## 2. Reasoning Layers (The Cascade Method)

### Layer 1: Perception (Raw Ingestion)
- **Data Sources:** Monitor and ingest `VE` (Detailed Sales), `C` (Current Accounts/Cards), `P` (Forecourt Totals), `S` (Shop Totals), and `T` (Tank/Inventory) files.
- **Context Identification:** Extract Station ID and Shift Number (e.g., Turno 88, Playa 1) from every file.
- **Validation:** Ensure file integrity before processing to prevent partial data ingestion.

### Layer 2: Logistics (Data Structuring)
- **Sales Parsing (`VE`):** Extract timestamp, product code, product name (e.g., SUPER, DIESEL X 10, CAFE), units/liters, unit price, and total amount.
- **Financial Mapping (`C`, `P`, `S`):** Map payment methods including VISA, Mercado Pago, MODO, and Corporate Accounts (e.g., ZONIS S.A., BAL-MAR S.R.L.).
- **Inventory Tracking (`T`):** Record remaining fuel levels (STOCK) for tanks TQ1 through TQN (dinámico, 1-99 tanques) at each shift close.

### Layer 3: Strategy (Intelligence & Machine Learning)
- **Reconciliation:** The `TOTAL SALE` in `P` and `S` files must match the aggregate sum of individual transactions in `VE` and credit/debit records in `C`.
- **Anomaly Detection:** Identify unusual negative values or manual adjustments in client accounts (e.g., negative balances for specific customers).
- **Behavioral Learning:** Map which products sell best at specific times and identify which employees consistently show cash discrepancies.

---

## 3. Learning Registry & Memory (Self-Correction)

### Dynamic Knowledge Base
The system maintains a `station_knowledge` table (JSONB per station) to:
1. **New Product Discovery:** If an unknown product name appears in `VE`, infer its category (Fuel, Shop, Lubricants) and update the global dictionary.
2. **Employee Profiling:** Record the "closing style" of each operator to predict and flag recurring human errors.
3. **Entity Resolution:** Learn and normalize company names in `C` files to prevent duplicates caused by manual typing errors in the legacy system.

---

## 4. Skills & Capabilities (Python Implementation)

- **`skill_extract_ve()`**: High-precision Regex for capturing fixed-width sales lines.
- **`skill_audit_cashflow()`**: Cross-reference declared totals against transactional data.
- **`skill_inventory_alert()`**: Calculate "Theoretical Sales" vs "Actual Stock" reported in `T` files.
- **`skill_behavior_mapping()`**: Track internal usage codes like `110 COMBUSTIBLE INTERNO` or `101 CORTESIA`.

---

## 5. Network Protocol (Scaling to 60 Stations)

1. **Isolation:** Each station's data is processed independently to prevent cross-contamination.
2. **Collective Intelligence:** Errors detected at Station A (e.g., a specific VB rounding bug) are uploaded to the Global Brain so Station B can automatically resolve them.
3. **Agent health:** Cada edge agent escribe `stations.last_heartbeat` cada 60s. El dashboard distingue "agente vivo" (< 5 min) de "lento" (< 30 min) y "offline" (> 30 min o NULL). Decisión explícita: los dueños NO quieren alertas — la señal única es el heartbeat + el estado de reconciliación en `daily_closings`.

---

## 6. Golden Rules
- **Non-Destructive:** Never modify or delete the original `.txt` files in `D:\SVAPP`.
- **Deep Investigation:** If `TOTAL SALE` doesn't match the transaction sum, investigate ticket-by-ticket until the error is found.
- **Continuous Improvement:** If an error repeats 3 times, generate a process change suggestion for the station manager.

---

## 7. Stack Técnico

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + TypeScript 5.8 + Vite 6 |
| Estilos | TailwindCSS (dark mode class-based) |
| Backend/DB | Supabase (PostgreSQL + Realtime + Auth) |
| Edge Agent | Python 3.11+ (watchdog, httpx, tenacity, PyYAML) |
| Cloud Logic | Google Cloud Functions (Python 3.11) |
| Mapas | Leaflet + React-Leaflet |
| Gráficos | Recharts |
| Notificaciones | Sonner (toasts) |
| Auth | Google OAuth2 (PKCE flow) |
| Mobile | Capacitor (Android PWA) |

---

## 8. Arquitectura del Sistema

```
C:\SVAPP\*.TXT                  ← legacy VB system writes files here
        ↓ (watchdog FileSystemEventHandler + debounce 2s)
edge_agent/watcher.py           ← detects new/modified .TXT files
        ↓ (MD5 idempotency check via state.json)
edge_agent/parsers/             ← VEParser, CParser, TParser, PParser, SParser, AParser
        ↓ (ParseResult: records + errors + raw_file)
edge_agent/uploader.py          ← POST to Supabase REST (service_role key)
        ↓
Supabase PostgreSQL             ← sales_transactions, tank_levels, card_payments, daily_closings, cash_closings
        ↓
Supabase Realtime               ← postgres_changes channel → React frontend
        ↓
DataContext.tsx                 ← single source of truth (carga inicial + suscripciones)
        ↓
React Components                ← MapBoard, PlayaView, ShopView, SalesHistoryView, etc.

--- Loop de Refresh (botón "Actualizar Datos") ---
React (App.tsx)                 → INSERT scan_requests (status=pending)
        ↓
edge_agent/watcher.py           ← polls scan_requests cada 15s
        ↓ (detecta pending → re-escanea C:\SVAPP)
edge_agent/uploader.py          → PATCH scan_requests (status=completed)
        ↓
React (App.tsx)                 ← polls hasta completed → toast + refreshData()
```

---

## 9. Archivos Críticos del Sistema

| Archivo | Responsabilidad |
|---|---|
| `edge_agent/watcher.py` | Monitor C:\SVAPP, dispatch a parsers, state.json, poll scan_requests cada 15s |
| `edge_agent/uploader.py` | POST a Supabase REST, idempotencia, check/update scan_requests |
| `edge_agent/service.py` | Windows Service wrapper con watcher auto-recuperable |
| `edge_agent/parsers/base_parser.py` | Clase abstracta ParseResult + detección de encoding |
| `edge_agent/parsers/ve_parser.py` | Parser VE*.TXT — ventas con turno + area_code + timezone -03:00 |
| `edge_agent/parsers/p_parser.py` | Parser P*.TXT — totales playa (forecourt) con turno |
| `edge_agent/parsers/s_parser.py` | Parser S*.TXT — totales salon (shop) con turno |
| `edge_agent/parsers/t_parser.py` | Parser T*.TXT — tanques dinámicos TQ1-TQ99, año 2/4 dígitos |
| `edge_agent/parsers/c_parser.py` | Parser C*.TXT — cuentas corrientes y tarjetas, detecta líneas corruptas VB |
| `edge_agent/parsers/a_parser.py` | Parser A*.TXT — caja (efectivo + cheques) por turno |
| `edge_agent/scheduled_scan.py` | One-shot scan invocado por la tarea programada (06:15, 14:15, 22:15) |
| `edge_agent/config.yaml` | supabase_url, watch_path, station_id, max_file_size |
| `edge_agent/setup.ps1` | Instalador automático: para servicio → copia → limpia cache → configura → arranca |
| `context/DataContext.tsx` | Estado global React + real-time subscriptions |
| `utils/mappers.ts` | DB snake_case ↔ App camelCase — incluye turno/area_code |
| `utils/dateUtils.ts` | `getArgentinaToday()` — SIEMPRE usar para fechas en frontend |
| `utils/supabaseHelpers.ts` | CRUD genérico — NO MODIFICAR |
| `types.ts` | Interfaces TypeScript + TankId dinámico + turno/areaCode |
| `types/dbRows.ts` | Mirror de columnas SQL para mappers |
| `components/TurnoFilter.tsx` | Filtro Mañana(6-14)/Tarde(14-22)/Noche(22-6) + `getTurnoFromTs()` |
| `components/PlayaView.tsx` | Datos P files EXCLUSIVAMENTE (SnapshotBreakdown), filtro turno |
| `components/ShopView.tsx` | Datos S files EXCLUSIVAMENTE (SnapshotBreakdown), filtro turno |
| `components/CajaView.tsx` | Datos A files — efectivo + cheques por turno |
| `components/Header.tsx` | Indicador de salud por estación (ONLINE/LENTO/OFFLINE) |
| `constants.ts` | MAP_CENTER, PRODUCT_CODES, ALERT_LEVELS, PAYMENT_METHODS |

---

## 10. Tablas Supabase

| Tabla | Propósito |
|---|---|
| `allowed_emails` | Whitelist de admins (sin cambios) |
| `stations` | 60 estaciones de servicio. Columna `last_heartbeat` (TIMESTAMPTZ) actualizada por el edge agent cada 60s — fuente de verdad para el indicador de salud |
| `employees` | Operadores por estación |
| `operator_auth` | auth.uid() → employee_id + station_id |
| `sales_transactions` | Cada línea de VE*.TXT — incluye `turno` y `area_code` (1=playa, 0=salon) |
| `card_payments` | Cada línea de C*.TXT procesada |
| `tank_levels` | Niveles TQ1-TQ99 de T*.TXT (dinámico, CHECK regex) |
| `daily_closings` | Totales P+S por turno. Columnas separadas P/S: `p_closing_ts`, `s_closing_ts`, `p_totals_snapshot`, `s_totals_snapshot`. UNIQUE: `(station_id, shift_date, turno)` |
| `cash_closings` | Totales A (efectivo + cheques) por turno. UNIQUE: `(station_id, shift_date, turno)` |
| `scan_requests` | Pedidos de refresh desde dashboard. Edge agent polls cada 15s |
| `station_knowledge` | JSONB de aprendizaje por estación |
| `notifications` | Notificaciones UI (sin cambios) |

### RLS Pattern
- **ADMIN:** `(auth.jwt() ->> 'email') IN (SELECT email FROM allowed_emails)`
- **OPERATOR:** `station_id IN (SELECT station_id FROM operator_auth WHERE user_id = auth.uid())`

---

## 11. Convenciones Técnicas

### IDs — CRÍTICO
- **NUNCA** usar `Date.now()`, `Math.random()` como ID primario en Supabase.
- **SIEMPRE** usar `generateUUID()` en TypeScript (función manual UUID v4).
- En Python para VE/C/T: `import uuid; str(uuid.uuid4())` — seguro en todos los entornos.
- **P/S/A parsers NO envían `id`** — PostgreSQL genera UUID vía `DEFAULT gen_random_uuid()`. Esto evita que el upsert de S sobreescriba el `id` que puso P en la misma fila.

### Non-Destructive File Handling — REGLA DE ORO
- El edge agent **NUNCA** escribe ni modifica archivos en `D:\SVAPP`.
- `state.json` registra qué archivos fueron procesados (MD5 + timestamp).
- Re-procesar el mismo archivo (mismo MD5) es idempotente — no duplica registros.

### Encoding de archivos VB legacy
- Intentar en orden: `latin-1` → `cp1252` → `utf-8`.
- Los sistemas VB de Argentina típicamente escriben en `cp1252` o `latin-1`.

### Reconciliación — Tolerancia
- Diferencia aceptable: `ABS(diff / total) <= 0.001` (0.1%, no 1%).
- Diferencia > 0.1% → `status = 'DISCREPANCY'` + alerta CRITICAL.

### `raw_line` — Audit Trail Obligatorio
- Todo registro en `sales_transactions`, `card_payments`, `tank_levels` debe incluir el campo `raw_line` con la línea original sin modificar.
- Permite re-parsear si se mejora el parser sin perder datos.

### Queries con `.maybeSingle()` — CRÍTICO
- **SIEMPRE** agregar `.limit(1)` antes de `.maybeSingle()`.
- Si hay filas duplicadas, `.maybeSingle()` devuelve error `PGRST116`.

### Dark mode
- Prefijo `dark:` obligatorio en todos los componentes Tailwind.
- Fondos: `dark:bg-slate-950` (páginas), `dark:bg-slate-900` (modales/cards).

### Colores de estado — semántica
| Estado | Color |
|---|---|
| RECONCILED / OK | `green` / `emerald` |
| PENDING | `amber` |
| DISCREPANCY / CRITICAL | `red` / `rose` |
| WARNING | `orange` |
| INFO | `blue` |
| Combustible | `amber` |
| Tienda | `violet` |
| Lubricantes | `teal` |

### Modales con scroll
```tsx
className="... flex flex-col max-h-[90vh]"  // container
className="... shrink-0"                      // header + footer
className="... overflow-y-auto"               // body
```

### Timezone Argentina — CRÍTICO
- **Frontend:** SIEMPRE usar `getArgentinaToday()` de `utils/dateUtils.ts` para "hoy".
- **NUNCA** usar `new Date().toISOString().slice(0,10)` — devuelve UTC, 3 horas adelantado después de las 21hs Argentina.
- **Parsers Python:** todos los timestamps deben terminar en `-03:00` (hora Argentina).
- Los archivos VB escriben hora local Argentina, no UTC.

### Turnos por horario — CRÍTICO
- Los turnos se definen por la hora real del archivo, NO por número secuencial del VB.
- **Mañana:** 06:00 - 14:00 | **Tarde:** 14:00 - 22:00 | **Noche:** 22:00 - 06:00
- El cierre del turno noche (22-06) aparece en el archivo del día siguiente.
- Usar `getTurnoFromTs()` de `components/TurnoFilter.tsx` para clasificar.
- `area_code`: `1` = playa (forecourt), `0` = salon (shop). Viene del VE parser.

### Tanques dinámicos
- **NO hardcodear** TQ1-TQ5. Las estaciones pueden tener de 1 a 99 tanques.
- DB constraint: `CHECK (tank_id ~ '^TQ[0-9]{1,2}$')`.
- `TankId` en TypeScript es `string`, no union fija.
- El T parser acepta cualquier número de tanque (valida solo que sea dígito).

### P/S parser — compatibilidad multi-estación
- El regex de P y S debe aceptar `NR.BCA` con o sin `%` al final: `(?:NR\.BCA\s+%?\d+)?\s*$`
- Cada estación VB puede tener formatos ligeramente diferentes.
- Si un parser falla en una estación nueva, comparar el archivo real vs el regex.

### Scan Requests — Botón Refresh del dashboard
- El dueño toca "Actualizar Datos" → INSERT en `scan_requests` con `status=pending`.
- El edge agent polls cada 15 segundos. Detecta pending → re-escanea SVAPP → marca `completed`.
- Dashboard polls cada 3s hasta que `status=completed` o timeout 60s.
- Solo funciona si el edge agent tiene el código nuevo instalado.

### Logging en flujos críticos
- Para **auth** y flujos de ingesta: usar `console.log/error/warn` directo, NO `logger`.
- `logger` solo imprime cuando `import.meta.env.DEV === true`.

### `_extract_shift_date_from_filename()` — NUNCA retorna None
- Cadena de fallback: YYYYMMDD → DDMMYYYY → DDMM+turno (año del mtime) → mtime del archivo → `date.today()`.
- Garantiza que `shift_date` SIEMPRE tiene un valor válido. Ningún archivo se descarta por falta de fecha.

### Uploader — Reintentos y resiliencia
- **HTTP 5xx:** se reintenta con backoff exponencial (máx 3 intentos). Supabase caído no pierde datos.
- **HTTP 4xx:** se loguea con detalle completo del error de PostgREST para diagnóstico.
- **Dead letter:** un solo archivo `.json` por archivo fallido (sobrescribe, no acumula). Incluye `last_error` con el mensaje de Supabase.
- **Archivos fallidos NUNCA se descartan.** Se reintentan en cada escaneo programado (06:15, 14:15, 22:15) hasta que funcionen.

### setup.ps1 — Flujo de instalación/reinstalación
1. Para servicio existente (`sc.exe stop StationOSEdgeAgent`)
2. Copia archivos Python al `C:\StationOS`
3. **Limpia `state.json` y `__pycache__`** (fuerza reprocesamiento completo)
4. Genera `config.yaml` y `.env`
5. Instala dependencias Python
6. Registra e inicia servicio Windows
7. Configura tarea programada de respaldo (06:15, 14:15, 22:15)

### PlayaView/ShopView — Solo datos P/S
- Playa muestra EXCLUSIVAMENTE el desglose del archivo P (`SnapshotBreakdown`): VENTAS DE COMBUSTIBLES, TIRADAS EFECTIVO, etc.
- Mini Mercado muestra EXCLUSIVAMENTE el desglose del archivo S.
- **NO muestran transacciones VE individuales.** Los productos VE solo se ven en Historial de Ventas.

### Indicador de salud de estación — Header
- Usa `stations.last_heartbeat` (actualizado cada 60s por el edge agent) como única fuente de verdad.
- Verde (ONLINE): < 5 min. Ámbar (LENTO): 5-30 min. Rojo (OFFLINE): > 30 min o NULL.
- Subscripción realtime a UPDATE de `stations` → el semáforo se actualiza en vivo sin refrescar.
- Click en el icono Activity muestra dropdown con estado por estación.

---

## 12. Self-Improvement Loop

Cada vez que se detecte un error de parsing o reconciliación que se repita 3+ veces:
1. Analizar si es un bug del sistema VB legacy o error humano.
2. Actualizar `station_knowledge.knowledge_blob` con la regla correctiva.
3. Si aplica globalmente: propagar a todas las estaciones vía `knowledge_updater` GCF.
4. Documentar en esta sección:

### Lecciones Aprendidas

#### PostgREST — Agregados y conteos
- **SUM de columna:** `?select=total_amount.sum()` devuelve `[{ "sum": "12345.67" }]` — siempre castear con `Decimal(str(row["sum"] or 0))`.
- **Conteo de filas afectadas por PATCH:** agregar header `Prefer: count=exact,return=minimal`; la respuesta incluye `Content-Range: 0-N/total` — parsear el total con `content_range.split("/")[-1]`.
- **`.maybeSingle()` con filas duplicadas:** siempre anteponer `.limit(1)` para evitar error `PGRST116`. Regla documentada en § 11.

#### Knowledge blob — Mutación segura
- El knowledge blob es JSONB en Postgres. Siempre hacer `copy.deepcopy(blob)` antes de modificar para evitar mutación accidental del objeto original en memoria del GCF.
- Al actualizar el blob vía PostgREST PATCH, enviar el objeto Python completo serializado como JSON — PostgREST reemplaza el campo JSONB completo (no hace merge parcial por defecto).

#### Edge Agent — Idempotencia MD5
- Los sistemas VB pueden escribir el mismo archivo varias veces en ráfaga durante un turno. La verificación MD5 en `state.json` es la única garantía de no duplicar registros. Sin ella, un archivo escrito 3 veces insertaría 3× los registros (el upsert con `on_conflict` ayuda pero no es suficiente si cambia el `ingested_at`).
- El debounce de 2 segundos en `TxtFileHandler._schedule()` absorbe las escrituras múltiples durante la generación del archivo. No bajar de 1.5 s para sistemas VB lentos.

#### Windows Service — Shutdown limpio
- `SvcStop()` debe llamar tanto a `win32event.SetEvent(self._scm_stop_event)` (desbloquea el `WaitForSingleObject` en `SvcDoRun`) como a `self._stop_event.set()` (señala al loop de watcher). Sin ambos, el servicio queda en estado `STOP_PENDING` indefinidamente.
- El hilo del watcher debe ser `daemon=True` para que no impida que el proceso del servicio termine si el join timeout expira.

#### Supabase Edge Functions — Auth en proxy GCF
- Las Edge Functions pueden verificar el JWT del llamador con `supabase.auth.getUser(token)` usando el `service_role` key del lado del servidor. Esto permite proteger endpoints GCF sin exponer URLs ni tokens al browser.
- Siempre responder con CORS headers (`Access-Control-Allow-Origin: *`) en Edge Functions llamadas desde el cliente React, incluyendo el preflight `OPTIONS`.

#### Reconciliación — Timing
- El reconciler se dispara cuando llega un archivo P o S. Si el archivo VE del mismo turno aún no fue procesado, `SUM(total_amount)` será 0 → falso DISCREPANCY. Solución: el reconciler retorna `"waiting_for_files"` si `forecourt_total` Y `shop_total` son ambos NULL, y el uploader re-dispara la reconciliación también al procesar archivos VE tardíos.
- Tolerancia de 0.1% (0.001), NO 1% — documentado en § 11. Los sistemas de facturación argentinos tienen redondeos de centavos que generarían falsos positivos con tolerancias más bajas.

#### Edge agent heartbeat (2026-04-15)
- `uploader.send_heartbeat(station_id)` hace PATCH a `stations.last_heartbeat` cada 60s desde el loop principal de `watcher.py` y también al final de `scheduled_scan.py`.
- El service.py ahora verifica cada 30s que el thread del watcher sigue vivo y lo relanza si murió silenciosamente (antes solo reiniciaba si lanzaba excepción).
- `sc.exe failure` configurado con `reset= 0 actions= restart/5000/restart/5000/restart/5000` + `failureflag 1` para que el SCM reinicie el servicio ante cualquier crash, incluso los no limpios.
- La tarea programada 06:15/14:15/22:15 ahora invoca `scheduled_scan.py` (script dedicado con timeout de 600s) en vez de un one-liner inline de 180s — más fácil de debuggear y con logs propios.

#### Alertas eliminadas (2026-04-15)
- Los dueños pidieron eliminar la sección Alertas. Se borró: frontend (AlertsView, useAlerts, DataContext), backend (`cloud_logic/anomaly_detector`, `alert_checker.py`, `_insert_alert_idempotent` del reconciler, `_insert_normalization_alert` del knowledge_updater), tabla `alerts` (DROP CASCADE) y tipos TS (`Alert`, `AlertLevel`, `AlertType`).
- El status `DISCREPANCY` de `daily_closings` sigue siendo la señal de reconciliación fallida — no se perdió esa información, solo la tabla paralela de alertas.
- Si en el futuro vuelven a pedirlas, leer este commit y el plan en `~/.claude/plans/sunny-toasting-abelson.md` antes de reimplementar.

#### T Parser — Formato de fecha variable y corrección de año
- Los archivos T pueden tener fecha `DD-MM-YY` (2 dígitos de año) o `DD-MM-YYYY` (4 dígitos). El regex usa `\d{2,4}`.
- **Bug resuelto:** Python `%y` interpreta "20" como año 2020, no 2026. Fix: `_parse_t_date()` usa el año del `mtime` del archivo (más confiable que `%y`) cuando el año tiene 2 dígitos. Si `mtime` no está disponible, usa `datetime.now().year`.
- El `recorded_at` ahora siempre tiene el año correcto.

#### P/S Parser — Formato NR.BCA variable
- Matheu: `NR.BCA 520` (sin %). Campana: `NR.BCA %151847` (con %). El regex original no matcheaba el `%` y descartaba TODOS los archivos P/S de Campana silenciosamente.
- Lección: antes de instalar en una estación nueva, probar los archivos localmente. Cada sistema VB puede tener variantes de formato.

#### Timezone — Todos los timestamps son Argentina (-03:00)
- Los archivos VB escriben hora local Argentina. Si el parser guarda sin timezone, Supabase interpreta como UTC y el browser resta 3 horas (06:01 → 03:01).
- Fix: todos los parsers (VE, T, C) agregan `-03:00` al ISO timestamp.

#### PlayaView/ShopView — Solo archivos P/S, sin VE
- Las vistas Playa y Shop muestran EXCLUSIVAMENTE el desglose del archivo P/S (`SnapshotBreakdown`).
- NO muestran transacciones VE individuales. Los productos VE solo se ven en Historial de Ventas.
- Si no hay archivos P/S procesados para la fecha, la vista muestra "Sin datos" — NO hace fallback a VE.
- Esto fue decisión explícita del dueño: cada archivo va a su sección correspondiente, sin mezclar.

#### setup.ps1 — No duplicar estaciones
- Antes de crear una estación nueva, buscar si ya existe con `GET stations?owner_email=eq.X&name=eq.Y`. Si existe, reutilizar el UUID. Esto permite reinstalar el edge agent sin crear estaciones duplicadas.

#### Array.from(Map.values()) — Pierde tipos en TypeScript
- `Array.from(map.values())` devuelve `unknown[]` en lugar del tipo genérico del Map.
- Usar `[...map.values()]` que preserva el tipo correctamente.

#### P/S/A Parsers — No enviar `id` en upsert
- PostgREST con `resolution=merge-duplicates` actualiza TODOS los campos del payload, incluido `id`. Si P envía `id=uuid-1` y luego S envía `id=uuid-2`, el `id` primario de la fila cambia. Esto rompe cualquier referencia FK futura.
- Fix: P, S y A parsers NO envían `id`. PostgreSQL genera UUID vía `DEFAULT gen_random_uuid()` al INSERT. En UPDATE (upsert conflict), `id` no se toca.
- VE, C y T parsers SÍ envían `id` porque cada registro es una fila nueva (no upsert de merge).

#### C Parser — Líneas corruptas VB
- El sistema VB puede generar montos corruptos como `% 95179928312.37D+%5` (línea 3 MASTERCARD).
- El regex `_C_LINE_RE` no matchea estas líneas → se saltean.
- Ahora se loguean como WARNING (`result.add_error`) para audit trail, en vez de silencio.
- Las líneas válidas del mismo archivo se procesan normalmente — una línea corrupta NO invalida el archivo.

#### Watcher — Archivos fallidos nunca se descartan
- Si un archivo falla el upload, se marca como `failed` en `state.json` (con `fail_count` y `last_error`).
- Se reintenta en cada escaneo programado (06:15, 14:15, 22:15) INDEFINIDAMENTE hasta que funcione.
- Si el contenido del archivo cambia (nuevo MD5), el contador de fallos se resetea.
- Dead letter: un solo archivo `.json` por archivo fuente (sobrescribe, no acumula).

#### Uploader — Retry en HTTP 5xx
- Supabase puede devolver 500/502/503 durante mantenimiento o sobrecarga.
- El uploader ahora re-lanza `httpx.NetworkError` para errores 5xx → tenacity los reintenta con backoff exponencial (3 intentos, máx 60s).
- Errores 4xx NO se reintentan (son errores de datos/schema, no transitorios).

#### DataContext — Subscripciones Real-time completas
- `tank_levels` ahora escucha `event: '*'` (INSERT + UPDATE), no solo INSERT.
- Cuando un T file se reprocesa (upsert → UPDATE en WAL), el frontend se actualiza sin refresh manual.
- `daily_closings` ya escuchaba `event: '*'` — correcto para P→S merge.

#### Servicio Windows — paths relativos y CWD=System32 (2026-04-15)
- Un servicio Windows corre con `CWD=C:\Windows\System32`. Cualquier path relativo (`.env`, `log_file`, `dead_letter_path`) se resuelve desde ahí, NO desde el directorio del agente.
- **Síntoma observado:** `setup.ps1` instala todo OK, `sc query` reporta `RUNNING`, pero el watcher muere en segundos porque `load_dotenv()` no encuentra `.env` → `service_key=""` → `sys.exit(1)`. SCM reinicia en loop infinito y el dueño no ve datos nuevos.
- **Fixes aplicados:**
  - `load_dotenv(_AGENT_DIR / ".env")` con path absoluto en `watcher.py` y `scheduled_scan.py`.
  - `setup.ps1` genera `config.yaml` con `log_file: 'C:\StationOS\logs\edge_agent.log'` y `dead_letter_path: 'C:\StationOS\logs\dead_letter\'`.
  - Las 3 `sys.exit(1)` en `watcher.main()` se reemplazaron por `raise RuntimeError(...)` para que `_resilient_watcher` las cachee como `Exception` y reintente con backoff de 10s. Antes, `SystemExit` (heredado de `BaseException`) se escapaba del `except Exception` y mataba el thread silenciosamente.
  - `service.py._resilient_watcher` ahora también cachea `SystemExit` por las dudas, con backoff de 30s.

#### setup.ps1 — verificación post-install efectiva
- `sc query STATE=RUNNING` es FALSO POSITIVO si el thread del watcher murió silenciosamente. La única señal real de que el agente está procesando es `stations.last_heartbeat` < 90s atrás.
- El instalador ahora hace polling de `last_heartbeat` durante 90s después de `sc start` y solo declara éxito si ve un heartbeat fresco. Si no, muestra las últimas líneas del log.

#### Watcher — rescan periódico cada 30 min (red de seguridad)
- Watchdog puede perder eventos en discos lentos, pausas del SO o cuando el OS está bajo carga. Para garantizar la promesa "todos los archivos por hora", el watcher hace un rescan completo de `C:\SVAPP` cada 30 minutos en su loop principal.
- La idempotencia MD5 en `state.json` garantiza que esto no duplica registros — los archivos ya procesados se saltean en el `is_processed()` check antes de leerse el contenido.
- Tareas programadas (06:15/14:15/22:15) siguen siendo el respaldo "fuera de proceso" si el servicio está caído.

#### Watcher — `_is_today` cubre turno noche cruzando medianoche
- Los archivos del turno noche (22-06) se escriben con la fecha del día anterior. Si se procesan después de medianoche, el `_is_today()` original los descartaba como "histórico" y nunca los reprocesaba aunque su MD5 hubiera cambiado.
- Fix: si la hora actual es < 03:00, también se acepta como "hoy" la fecha de ayer.

#### Scheduled_scan — fallback completo del botón refresh
- Si el servicio principal está caído, `scheduled_scan.py` (Task Scheduler 06:15/14:15/22:15) ahora también marca como `completed` cualquier `scan_request` pendiente al final de su run. Sin esto, el botón "Actualizar Datos" del dashboard quedaba colgado en `pending` para siempre.
- Además, antes leía config con keys planos (`config["watch_path"]`, etc.) que no existían — el config real es anidado. Refactor completo a la estructura correcta + `load_dotenv()`.

#### Refresh button — multi-station + realtime (2026-04-15)
- El botón "Actualizar Datos" inserta UN scan_request por cada estación del dueño (RLS filtra a las suyas) — antes solo refrescaba `activeStationId || stations[0]`.
- La detección de completion usa **realtime sobre `scan_requests`** (publication agregada en migration `20260415_scan_requests_realtime.sql`) — instantáneo, sin polling de 3s.
- Polling de 5s queda como fallback si realtime falla. Timeout total: 90s. Si > 3 errores consecutivos en el poll, aborta con toast claro.
- Toast final agrega `M archivos en N estaciones`, separa "todas con error" / "algunas con error" / "todo OK".

#### Logging — Cambiar prefijo desconocido a WARNING
- Si aparece un archivo con prefijo no mapeado en `FILE_PREFIX_MAP` (ej. tipo de archivo VB nuevo), `process_file()` ahora lo loguea como WARNING en vez de DEBUG. Antes el archivo se descartaba en silencio sin que el dueño/dev se enterara.

---

## 13. Auto-Actualización de CLAUDE.md

Este archivo es el cerebro del proyecto. Debe mantenerse actualizado:

### Cuándo actualizar
- Al agregar una **tabla nueva** en Supabase → actualizar § 10.
- Al agregar un **archivo crítico** → actualizar § 9.
- Al descubrir un **bug recurrente** que aplica a futuro → agregar en § 12 Lecciones.
- Al establecer una **convención nueva** (ej: timezone, filtros) → agregar en § 11.
- Al cambiar la **arquitectura** (nuevo flujo de datos) → actualizar § 8.

### Cómo actualizar
- Editar directamente este archivo al final de cada sesión de trabajo.
- Cada lección debe incluir: QUÉ pasó, POR QUÉ falló, y CÓMO se resolvió.
- No repetir lo que ya está en el código — solo documentar lo NO OBVIO.

### Qué NO poner acá
- Código — para eso está el código.
- Estado temporal — para eso está el todo list.
- Historial de cambios — para eso está git log.
