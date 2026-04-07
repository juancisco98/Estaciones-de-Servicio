# Station-OS

**Inteligencia operativa en tiempo real para red de estaciones de servicio.**

Station-OS ingesta automáticamente los archivos `.TXT` generados por el sistema legacy Visual Basic de cada estación, los parsea, reconcilia totales, detecta anomalías y expone todo en un dashboard React accesible desde celular o computadora.

---

## Arquitectura

```
C:\SVAPP\*.TXT                  ← Sistema legacy VB escribe archivos aquí
        ↓ watchdog FileSystemEventHandler + debounce 2s
edge_agent/watcher.py           ← Detecta archivos nuevos/modificados
        ↓ MD5 idempotency check (state.json)
edge_agent/parsers/             ← VEParser, CParser, TParser, PParser, SParser, AParser
        ↓ ParseResult: records + errors + raw_line
edge_agent/uploader.py          ← POST a Supabase REST (service_role key, retry 5xx)
        ↓
Supabase PostgreSQL             ← sales_transactions, tank_levels, card_payments,
                                   daily_closings, cash_closings
        ↓
Supabase Realtime               ← postgres_changes → React frontend
        ↓
React PWA                       ← Dashboard con vistas por archivo:
                                   Ventas (VE), Playa (P), Mini Mercado (S),
                                   Tanques (T), Cuentas Corrientes (C), Caja (A)
```

---

## Stack Técnico

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + TypeScript 5.8 + Vite 6 |
| Estilos | Tailwind CSS (dark mode class-based) |
| Backend/DB | Supabase (PostgreSQL + Realtime + Auth) |
| Edge Agent | Python 3.11+ (watchdog, httpx, tenacity, PyYAML) |
| Mapas | Leaflet + React-Leaflet |
| Gráficos | Recharts |
| Notificaciones | Sonner (toasts) |
| Auth | Google OAuth2 (PKCE) |
| Mobile | Capacitor (Android PWA) |

---

## Setup — Edge Agent (Instalación en estación)

El edge agent se instala en la PC servidor de la estación donde el sistema VB escribe los archivos `.TXT` en `C:\SVAPP`.

**Requisitos:** Windows 10+, Python 3.11+, acceso a `C:\SVAPP`

```powershell
# 1. Copiar carpeta edge_agent a la PC del cliente (ej: vía pendrive)

# 2. Abrir PowerShell como Administrador y ejecutar:
cd C:\ruta\a\edge_agent
powershell -ExecutionPolicy Bypass -File setup.ps1

# El instalador pregunta:
#   - Email del dueño (para acceso al dashboard)
#   - Nombre de la estación
#   - Dirección (se geocodifica automáticamente)
```

### Qué hace setup.ps1:
1. Verifica Python 3.11+ (instala si falta)
2. Registra la estación en Supabase (no duplica si ya existe)
3. Para el servicio existente (si hay reinstalación)
4. Copia archivos a `C:\StationOS`
5. Limpia `state.json` y `__pycache__` (fuerza reprocesamiento)
6. Genera `config.yaml` y `.env`
7. Instala dependencias Python
8. Registra e inicia servicio Windows (`StationOSEdgeAgent`)
9. Configura tarea programada de respaldo (06:15, 14:15, 22:15)

### Comandos manuales del servicio:
```powershell
sc.exe stop StationOSEdgeAgent     # Detener
sc.exe start StationOSEdgeAgent    # Iniciar
sc.exe query StationOSEdgeAgent    # Ver estado
```

---

## Setup — Frontend

**Requisitos:** Node.js 20+

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local:
#   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
#   VITE_SUPABASE_ANON_KEY=tu-anon-key

# 3. Desarrollo
npm run dev

# 4. Producción
npm run build
```

---

## Setup — Base de Datos Supabase

Ejecutar en el SQL Editor de Supabase en este orden:

```sql
-- 1. Schema base
-- Ejecutar: supabase/migrations/20260401_station_os_schema.sql

-- 2. Multi-tenant
-- Ejecutar: supabase/migrations/20260402_multi_tenant.sql

-- 3. Turno + área + tanques dinámicos
-- Ejecutar: models/20260403_turno_area_dynamic_tanks.sql

-- 4. Columnas adicionales (P/S snapshots, cash_closings)
ALTER TABLE daily_closings ADD COLUMN IF NOT EXISTS closing_ts TIMESTAMPTZ;
ALTER TABLE daily_closings ADD COLUMN IF NOT EXISTS p_closing_ts TIMESTAMPTZ;
ALTER TABLE daily_closings ADD COLUMN IF NOT EXISTS s_closing_ts TIMESTAMPTZ;
ALTER TABLE daily_closings ADD COLUMN IF NOT EXISTS p_totals_snapshot JSONB;
ALTER TABLE daily_closings ADD COLUMN IF NOT EXISTS s_totals_snapshot JSONB;
ALTER TABLE daily_closings ADD COLUMN IF NOT EXISTS totals_snapshot JSONB;
ALTER TABLE tank_levels ADD COLUMN IF NOT EXISTS shift_date DATE;

CREATE TABLE IF NOT EXISTS cash_closings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    shift_date DATE NOT NULL,
    turno INT,
    caja_total NUMERIC(14,2),
    cheque_total NUMERIC(14,2),
    closing_ts TIMESTAMPTZ,
    a_file_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (station_id, shift_date, turno)
);
ALTER TABLE cash_closings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access" ON cash_closings FOR ALL USING (is_admin());

NOTIFY pgrst, 'reload schema';
```

---

## Tipos de Archivos VB

| Prefijo | Tabla Supabase | Vista Frontend | Contenido |
|---|---|---|---|
| `VE*.TXT` | `sales_transactions` | Historial de Ventas | Cada venta individual (producto, litros, precio, hora) |
| `P*.TXT` | `daily_closings` | Playa | Totales del turno playa (combustibles, efectivo, tarjetas) |
| `S*.TXT` | `daily_closings` | Mini Mercado | Totales del turno salón (ventas, tarjetas) |
| `T*.TXT` | `tank_levels` | Niveles de Tanques | Stock por tanque TQ1–TQ99 al cierre |
| `C*.TXT` | `card_payments` | Cuentas Corrientes | Saldos de tarjetas y cuentas de clientes |
| `A*.TXT` | `cash_closings` | Caja | Efectivo y cheques al cierre del turno |

### Nomenclatura de archivos
- Formato: `PREFIJO + DDMM + TURNO_SEQ.TXT` (ej: `P01041.TXT` = Playa, día 01, mes 04, turno 1)
- 18 archivos por día por estación: 3 de cada tipo (P/S/C/T/A) + 1 VE acumulativo
- VE: `VEDDMM + SEQ.TXT` (ej: `VE04046.TXT` = día 04, mes 04, secuencia 6)

---

## Estructura de Archivos

```
station-os/
├── edge_agent/                 ← Agente Python local (corre en servidor de estación)
│   ├── watcher.py              ← Monitor watchdog + state.json + scan_requests
│   ├── uploader.py             ← Upload a Supabase REST (retry 5xx, dead_letter)
│   ├── service.py              ← Windows Service (StationOSEdgeAgent)
│   ├── setup.ps1               ← Instalador automático (3 preguntas)
│   ├── requirements.txt
│   └── parsers/
│       ├── base_parser.py      ← Clase abstracta + encoding + shift_date extraction
│       ├── ve_parser.py        ← VE*.TXT — ventas individuales
│       ├── p_parser.py         ← P*.TXT — totales playa
│       ├── s_parser.py         ← S*.TXT — totales salón
│       ├── t_parser.py         ← T*.TXT — niveles de tanques
│       ├── c_parser.py         ← C*.TXT — cuentas corrientes/tarjetas
│       └── a_parser.py         ← A*.TXT — caja (efectivo + cheques)
├── components/                 ← Componentes React
│   ├── Header.tsx              ← Indicador de salud por estación (ONLINE/LENTO/OFFLINE)
│   ├── PlayaView.tsx           ← Desglose archivo P (solo SnapshotBreakdown)
│   ├── ShopView.tsx            ← Desglose archivo S (solo SnapshotBreakdown)
│   ├── CajaView.tsx            ← Efectivo + cheques (archivo A)
│   ├── SalesHistoryView.tsx    ← Historial de ventas VE (filtro sector playa/salon)
│   ├── CardPaymentsView.tsx    ← Cuentas corrientes (archivo C)
│   ├── TankLevelsView.tsx      ← Niveles de tanques (archivo T)
│   └── TurnoFilter.tsx         ← getTurnoFromTs() + getTurnoFromClosingTs()
├── context/
│   └── DataContext.tsx         ← Estado global + subscripciones real-time
├── types/                      ← Interfaces TypeScript
├── utils/                      ← Mappers, dateUtils, helpers
├── services/                   ← Cliente Supabase
└── supabase/migrations/        ← Schema SQL
```

---

## Garantías del Sistema

- **No destructivo:** El edge agent **nunca modifica** los archivos `.TXT` originales en `C:\SVAPP`.
- **Idempotente:** Re-procesar el mismo archivo (mismo MD5) no duplica registros.
- **Ningún archivo se descarta:** Si un upload falla, se reintenta indefinidamente hasta que funcione.
- **Audit trail:** Cada registro incluye `raw_line` con la línea original sin modificar.
- **Tolerancia de reconciliación:** `ABS(diff / total) ≤ 0.1%` → RECONCILED, > 0.1% → DISCREPANCY.
- **Servicio persistente:** El edge agent corre como Windows Service con reinicio automático ante fallos + tarea programada de respaldo cada 8 horas.
- **Monitoreo remoto:** El dashboard muestra el estado de cada estación (ONLINE/LENTO/OFFLINE) basado en la última sincronización.
- **Timezone:** Todos los timestamps son Argentina UTC-3 (sin horario de verano desde 2009).

---

## Licencia

MIT — ver [LICENSE](LICENSE)
