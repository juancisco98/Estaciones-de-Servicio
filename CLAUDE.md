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
- **Inventory Tracking (`T`):** Record remaining fuel levels (STOCK) for tanks TQ 1 through TQ 5 at each shift close.

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
3. **Alert Priority:**
   - **Level 1 (Critical):** Cash discrepancy > 1% or unexplained stock drop.
   - **Level 2 (Warning):** Low tank levels or failed transaction reconciliations.
   - **Level 3 (Info):** Daily sales summaries and trend reports for the owner.

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
| Edge Agent | Python 3.11+ (watchdog, httpx, pydantic) |
| Cloud Logic | Google Cloud Functions (Python 3.11) |
| Mapas | Leaflet + React-Leaflet |
| Gráficos | Recharts |
| Notificaciones | Sonner (toasts) |
| Auth | Google OAuth2 (PKCE flow) |
| Mobile | Capacitor (Android PWA) |

---

## 8. Arquitectura del Sistema

```
D:\SVAPP\<station_code>\*.TXT   ← legacy VB system writes files here
        ↓ (watchdog FileSystemEventHandler)
edge_agent/watcher.py           ← detects new/modified .TXT files
        ↓ (MD5 idempotency check via state.json)
edge_agent/parsers/             ← VEParser, CParser, TParser, PParser, SParser
        ↓ (ParseResult: records + errors + raw_file)
edge_agent/uploader.py          ← POST to Supabase REST (service_role key)
        ↓
Supabase PostgreSQL              ← sales_transactions, tank_levels, card_payments, daily_closings
        ↓ (Supabase Edge Function webhook)
cloud_logic/reconciler          ← P+S totals vs VE sum cross-check
cloud_logic/anomaly_detector    ← negative values, cash variance >1%, low tanks
        ↓ (INSERT into alerts table)
Supabase Realtime               ← postgres_changes channel → React frontend
        ↓
DataContext.tsx                 ← single source of truth
        ↓
React Components                ← MapBoard (60 stations), AlertsView, ReconciliationView, etc.
```

---

## 9. Archivos Críticos del Sistema

| Archivo | Responsabilidad |
|---|---|
| `edge_agent/watcher.py` | Monitor D:\SVAPP, dispatch a parsers, gestionar state.json |
| `edge_agent/uploader.py` | POST autenticado a Supabase REST, idempotencia por MD5 |
| `edge_agent/parsers/base_parser.py` | Clase abstracta ParseResult + detección de encoding |
| `edge_agent/parsers/ve_parser.py` | Parser más complejo — líneas de venta fija VE*.TXT |
| `edge_agent/config.yaml` | supabase_url, watch_path, station_mappings |
| `cloud_logic/reconciler/main.py` | GCF: reconciliar totales declarados vs suma VE |
| `cloud_logic/anomaly_detector/main.py` | GCF: detectar anomalías por regla |
| `models/schema.sql` | Esquema SQL canónico (mirror de migrations/) |
| `context/DataContext.tsx` | Estado global React + real-time subscriptions |
| `utils/mappers.ts` | DB snake_case ↔ App camelCase (REESCRITO para Station-OS) |
| `utils/supabaseHelpers.ts` | CRUD genérico — NO MODIFICAR |
| `types.ts` | Interfaces TypeScript del dominio gas station |
| `constants.ts` | MAP_CENTER, PRODUCT_CODES, ALERT_LEVELS, PAYMENT_METHODS |

---

## 10. Tablas Supabase

| Tabla | Propósito |
|---|---|
| `allowed_emails` | Whitelist de admins (sin cambios) |
| `stations` | 60 estaciones de servicio |
| `employees` | Operadores por estación |
| `operator_auth` | auth.uid() → employee_id + station_id |
| `sales_transactions` | Cada línea de VE*.TXT procesada |
| `card_payments` | Cada línea de C*.TXT procesada |
| `tank_levels` | Niveles TQ1-TQ5 de T*.TXT |
| `daily_closings` | Totales P+S + estado de reconciliación |
| `alerts` | Alertas CRITICAL/WARNING/INFO generadas |
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
- En Python: `import uuid; str(uuid.uuid4())` — seguro en todos los entornos.

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

### Logging en flujos críticos
- Para **auth** y flujos de ingesta: usar `console.log/error/warn` directo, NO `logger`.
- `logger` solo imprime cuando `import.meta.env.DEV === true`.

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

#### Anomaly Detector — Cap de alertas
- `MAX_ALERTS_PER_BATCH = 5` evita que un archivo VE corrupto con 500 líneas negativas genere 500 alertas CRITICAL en segundos, colapsando la UI. Las primeras 5 son suficientes para notificar al operador.
- La idempotencia de alertas (`_insert_alert_idempotent`) verifica por `(station_id, type, related_date, resolved=false)`. Si se re-procesa el mismo archivo, no duplica alertas.
