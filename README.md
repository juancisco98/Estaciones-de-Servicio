# Station-OS

**Inteligencia operativa en tiempo real para red de estaciones de servicio.**

Station-OS ingesta automáticamente los archivos `.TXT` generados por el sistema legacy Visual Basic de cada estación, los parsea, reconcilia totales, detecta anomalías y expone todo en un dashboard React accesible desde celular o computadora.

---

## Arquitectura

```
D:\SVAPP\<station_code>\*.TXT   ← Sistema legacy VB escribe archivos aquí
        ↓ watchdog FileSystemEventHandler
edge_agent/watcher.py           ← Detecta archivos nuevos/modificados
        ↓ MD5 idempotency check (state.json)
edge_agent/parsers/             ← VEParser, CParser, TParser, PParser, SParser
        ↓ ParseResult: records + errors + raw_line
edge_agent/uploader.py          ← POST a Supabase REST (service_role key)
        ↓
Supabase PostgreSQL              ← sales_transactions, tank_levels, card_payments, daily_closings
        ↓ Edge Function webhook
cloud_logic/reconciler          ← Reconciliación P+S vs suma VE
cloud_logic/anomaly_detector    ← Negativos, varianza de caja, tanques bajos
        ↓ INSERT en tabla alerts
Supabase Realtime               ← postgres_changes → React frontend
        ↓
React PWA                        ← MapBoard (60 estaciones), AlertsView, ReconciliationView
```

---

## Stack Técnico

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + TypeScript 5.8 + Vite 6 |
| Estilos | Tailwind CSS v4 (dark mode class-based) |
| Backend/DB | Supabase (PostgreSQL + Realtime + Auth) |
| Edge Agent | Python 3.11+ (watchdog, httpx, pydantic) |
| Cloud Logic | Google Cloud Functions (Python 3.11) |
| Mapas | Leaflet + React-Leaflet |
| Gráficos | Recharts |
| Notificaciones | Sonner (toasts) |
| Auth | Google OAuth2 (PKCE) |
| Mobile | Capacitor (Android PWA) |

---

## Setup — Frontend

**Requisitos:** Node.js 20+

```bash
# 1. Clonar el repositorio
git clone <repo-url>
cd station-os

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con los valores de tu proyecto Supabase:
#   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
#   VITE_SUPABASE_ANON_KEY=tu-anon-key

# 4. Iniciar servidor de desarrollo
npm run dev
# → http://localhost:3000

# 5. Build de producción
npm run build
npm run preview
```

---

## Setup — Edge Agent (Windows)

El edge agent se instala en la computadora **servidor de la estación**, donde vive `D:\SVAPP`.

**Requisitos:** Python 3.11+, acceso al directorio `D:\SVAPP`

```bash
cd edge_agent

# 1. Crear entorno virtual e instalar dependencias
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

# 2. Configurar credenciales
cp config.yaml.example config.yaml
# Editar config.yaml:
#   supabase.url: <tu Supabase URL>
#   supabase.service_key_env: SUPABASE_SERVICE_KEY
#   watcher.watch_path: D:\SVAPP
#   stations:
#     EST_001: <uuid de la estación en Supabase>

# Crear .env con la service key (nunca commitear este archivo)
echo SUPABASE_SERVICE_KEY=tu-service-role-key > .env

# 3. Probar en modo debug (sin instalar servicio)
python -m edge_agent.watcher --config config.yaml
# o usando el script de gestión:
install.bat debug

# 4. Instalar como servicio de Windows (ejecutar como Administrador)
install.bat install
install.bat start
install.bat status
```

### Comandos del agente

```
install.bat install   → Registrar servicio de Windows
install.bat start     → Iniciar el servicio
install.bat stop      → Detener el servicio
install.bat restart   → Reiniciar
install.bat status    → Ver estado actual
install.bat remove    → Desregistrar el servicio
install.bat debug     → Ejecutar interactivamente (sin servicio)
install.bat logs      → Tail del log en tiempo real
```

---

## Setup — Cloud Functions (Google Cloud)

**Requisitos:** `gcloud` CLI autenticado, proyecto GCP configurado

```bash
cd cloud_logic

# Configurar variables
export GCP_PROJECT_ID=tu-proyecto-gcp
export SUPABASE_URL=https://tu-proyecto.supabase.co
export SUPABASE_SERVICE_KEY=tu-service-role-key

# Desplegar las tres funciones
chmod +x deploy.sh
./deploy.sh
```

---

## Setup — Base de Datos Supabase

```bash
# Aplicar el schema completo de Station-OS
supabase db push
# o ejecutar directamente:
# supabase/migrations/20260401_station_os_schema.sql
```

El schema crea las tablas: `stations`, `employees`, `operator_auth`, `sales_transactions`, `card_payments`, `tank_levels`, `daily_closings`, `alerts`, `station_knowledge`, `allowed_emails`, `notifications`.

**RLS:** Los administradores se autentican vía `allowed_emails`. Los operadores solo ven datos de su estación (vía `operator_auth`).

---

## Deploy Frontend — Vercel

En el dashboard de Vercel, conectar el repositorio y configurar:
- Framework: Vite
- Build command: `npm run build`
- Output dir: `dist`
- Variables de entorno: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

---

## Estructura de Archivos

```
station-os/
├── edge_agent/              ← Agente Python local (corre en servidor de estación)
│   ├── watcher.py           ← Monitor watchdog + pipeline principal
│   ├── uploader.py          ← Upload autenticado a Supabase REST
│   ├── service.py           ← Wrapper Windows Service (pywin32)
│   ├── install.bat          ← Gestión del servicio de Windows
│   ├── config.yaml          ← Configuración de estaciones y Supabase
│   ├── requirements.txt
│   └── parsers/
│       ├── ve_parser.py     ← VE*.TXT — líneas de venta
│       ├── c_parser.py      ← C*.TXT — pagos con tarjeta/cuenta
│       ├── t_parser.py      ← T*.TXT — niveles de tanques
│       ├── p_parser.py      ← P*.TXT — totales playa
│       └── s_parser.py      ← S*.TXT — totales tienda
├── cloud_logic/             ← Google Cloud Functions
│   ├── reconciler/          ← Reconcilia totales declarados vs transacciones
│   ├── anomaly_detector/    ← Detecta anomalías operativas
│   └── knowledge_updater/   ← Clasifica productos desconocidos
├── supabase/
│   └── migrations/
│       └── 20260401_station_os_schema.sql
├── components/              ← Componentes React
├── context/                 ← DataContext (estado global + real-time)
├── hooks/                   ← Hooks por entidad (useStations, useAlerts, etc.)
├── types/                   ← Interfaces TypeScript
├── utils/                   ← Mappers, helpers
└── services/                ← Clientes Supabase + Cloud Functions
```

---

## Tipos de Archivos VB

| Prefijo | Tabla Supabase | Contenido |
|---|---|---|
| `VE*.TXT` | `sales_transactions` | Líneas de venta (timestamp, producto, litros, precio) |
| `C*.TXT` | `card_payments` | Pagos con tarjeta / cuentas corrientes |
| `T*.TXT` | `tank_levels` | Niveles de tanques TQ1–TQ5 |
| `P*.TXT` | `daily_closings` | Total playa declarado |
| `S*.TXT` | `daily_closings` | Total tienda declarado |

---

## Garantías del Sistema

- **No destructivo:** El edge agent **nunca modifica** los archivos `.TXT` originales en `D:\SVAPP`.
- **Idempotente:** Re-procesar el mismo archivo (mismo MD5) no duplica registros.
- **Audit trail:** Cada registro incluye `raw_line` con la línea original sin modificar.
- **Tolerancia de reconciliación:** `ABS(diff / total) ≤ 0.1%` → RECONCILED, > 0.1% → DISCREPANCY + alerta CRITICAL.
- **Servicio persistente:** El edge agent corre como Windows Service con reinicio automático ante fallos.

---

## Licencia

MIT — ver [LICENSE](LICENSE)
