# CLAUDE.md — Rufianes Barbershop

Archivo de instrucciones persistentes para Claude Code. Documenta el proyecto, convenciones técnicas y lecciones aprendidas de debugging real. Claude debe consultar este archivo al iniciar cada sesión y actualizarlo cuando aprenda algo nuevo.

---

## Contexto del Proyecto

**¿Qué hace la app?**
Rufianes es una aplicación de gestión para una red de 8 barberías en Buenos Aires, Argentina. Permite:
- Ver las 8 barberías en un mapa interactivo con métricas en tiempo real
- Registrar cortes de pelo por barbero (cliente, servicio, precio, tiempo, método de pago)
- Calcular comisiones automáticas para cada barbero por corte
- Realizar cierres de turno (cierre diario con totales de efectivo, tarjeta y transferencia)
- Ver analytics de revenue por barbería, por barbero, por período
- Portal exclusivo para barberos: registrar sus propios cortes y cerrar su turno

**Dos roles de usuario:**
- **ADMIN**: Emails en `allowed_emails` table (juan.sada98@gmail.com). Acceso total a las 8 barberías, analytics, gestión de barberos y servicios.
- **BARBER**: Email del barbero en tabla `barbers` + registro en `barber_auth`. Solo ve su portal personal, sus cortes del día y puede hacer cierre de turno.

**Stack técnico:**
| Capa | Tecnología |
|---|---|
| Framework | React 19.2 + TypeScript 5.8 + Vite 6 |
| Estilos | TailwindCSS (class-based dark mode) |
| Backend | Supabase (PostgreSQL + Realtime + Auth) |
| Íconos | Lucide React |
| Notificaciones | Sonner (toasts) |
| Gráficos | Recharts |
| Mapas | Leaflet + React-Leaflet |
| Mobile | Capacitor (Android PWA) |
| Auth | Google OAuth2 (PKCE flow) |

---

## Arquitectura

### Flujo de datos
```
Supabase DB
    ↕ (real-time postgres_changes channel)
DataContext.tsx  ← fuente única de verdad para toda la app
    ↕
Custom Hooks (useBarbershops, useBarbers, useSessions, useShiftClosings, useAnalytics, useServices)
    ↕ (data + handlers)
Componentes UI (BarberPortal, BarbersView, AnalyticsDashboard, etc.)
```

### Archivos críticos
| Archivo | Responsabilidad |
|---|---|
| `context/DataContext.tsx` | Estado global, real-time Supabase, `refreshData()` |
| `utils/mappers.ts` | Conversión DB (snake_case) ↔ App (camelCase) |
| `utils/supabaseHelpers.ts` | CRUD genérico: `supabaseUpsert`, `supabaseInsert`, `supabaseUpdate`, `supabaseDelete` |
| `services/supabaseClient.ts` | Cliente Supabase, auth, `signOut()` |
| `types.ts` | Todas las interfaces TypeScript de la app |
| `types/dbRows.ts` | Tipos de las filas de DB (snake_case) |
| `constants.ts` | `ALLOWED_EMAILS`, `MAP_CENTER`, `DEFAULT_SERVICES`, `PAYMENT_METHOD_LABELS`, etc. |
| `components/BarberPortal.tsx` | Portal del barbero: registrar cortes y cerrar turno |
| `components/RegisterSessionModal.tsx` | Modal para registrar un corte (precio, servicio, método de pago) |
| `components/ShiftClosingModal.tsx` | Modal para cierre de turno (totales, gastos, efectivo a entregar) |
| `components/AnalyticsDashboard.tsx` | Dashboard de analytics para el admin |

### Tablas Supabase
- `allowed_emails` — whitelist de admins
- `barbershops` — 8 locales de Rufianes en el mapa
- `barbers` — barberos por local (con comisión %)
- `services` — catálogo de servicios (globales o por barbería)
- `clients` — clientes frecuentes (opcional)
- `haircut_sessions` — cada corte registrado (precio snapshot, comisión snapshot)
- `shift_closings` — cierres de turno diarios por barbero
- `barber_auth` — mapea auth.uid() → barber_id para el login del barbero
- `notifications` — notificaciones para admin y barberos

### RLS (Row Level Security)
- Admins: acceso total via subquery `(auth.jwt() ->> 'email') IN (SELECT email FROM allowed_emails)`
- Barbers: INSERT en haircut_sessions donde barber_id coincide con su barber_auth, SELECT su barbershop, CRUD sus shift_closings

### Estado de un cierre de turno
```
OPEN (abierto al iniciar el día) → (barbero registra cortes) → CLOSED (al cerrar el turno)
```
- `OPEN`: turno activo del día
- `CLOSED`: turno finalizado — las sesiones vinculadas son INMUTABLES

---

## Guía de Estilo y Convenciones

### IDs — CRÍTICO
- **NUNCA** usar `Date.now()`, `Math.random()` o strings con prefijos como ID primario en Supabase.
- **SIEMPRE** generar UUIDs válidos con la función `generateUUID()`:
```typescript
const generateUUID = (): string =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
```
- **Por qué**: `crypto.randomUUID()` falla/cuelga en entornos HTTP sin TLS (desarrollo local).

### Comisión — REGLA CRÍTICA
- **SIEMPRE** guardar el `commission_pct` y `commission_amt` como snapshot en el momento del corte, no calcularlo dinámicamente después.
- Si el barbero cambia su % de comisión, los cortes pasados NO deben verse afectados.
- `commission_amt = price * commissionPct / 100` — siempre computado en el cliente al crear la sesión.

### Sesiones vinculadas a un cierre CERRADO son INMUTABLES
- Una vez que un `shift_closing` tiene `status = 'CLOSED'`, ninguna de sus `haircut_sessions` puede ser eliminada ni editada.
- En la UI: ocultar botón eliminar si `session.shiftClosingId` existe y el closing está CLOSED.
- En el hook `useSessions.deleteSession`: lanzar error si `session.shiftClosingId` no es null.

### netCashToHand — siempre = totalCash - expensesCash
- **NUNCA** incluir `totalCard` ni `totalTransfer` en el cálculo de `netCashToHand`.
- El dinero a entregar al dueño es SOLO el efectivo menos los gastos en efectivo.
- La tarjeta y transferencia se reciben por separado (no pasan por la mano del barbero).

### Cálculo de métricas — filtrar por fecha con slice(0, 10)
- Las sesiones tienen `started_at` como ISO timestamp completo.
- Al filtrar "cortes de hoy": `session.startedAt.slice(0, 10) === today`.
- **NUNCA** comparar timestamps completos para filtros de fecha — usar siempre `.slice(0, 10)`.

### Dark mode
- Usar siempre el prefijo `dark:` de Tailwind para todos los componentes.
- Fondo oscuro: `dark:bg-slate-950` (páginas), `dark:bg-slate-900` (modales/cards).
- Bordes oscuros: `dark:border-white/10`.
- Texto oscuro: `dark:text-white`, `dark:text-slate-300`, `dark:text-slate-400`.

### Modales con scroll (patrón obligatorio)
Cualquier modal que pueda superar el alto de pantalla DEBE usar:
```tsx
// Container del modal
className="... flex flex-col max-h-[90vh]"
// Header del modal
className="... shrink-0"
// Body del modal (scrolleable)
className="... overflow-y-auto"
// Footer del modal
className="... shrink-0"
```

### Colores de estado — semántica obligatoria
| Estado | Color Tailwind |
|---|---|
| CLOSED / Pagado / Completo | `green` / `emerald` |
| OPEN / Activo | `amber` |
| Error / Eliminado | `red` / `rose` |
| Sin datos / Inactivo | `gray` / `slate` |
| Acción primaria | `amber` (no indigo — Rufianes usa amber como color primario) |
| Efectivo | `emerald` |
| Tarjeta | `blue` |
| Transferencia | `violet` |

### Emails de barberos — normalización obligatoria
- Al guardar emails en Supabase: `email.trim().toLowerCase()`
- Al comparar emails en queries JS: usar `.ilike('email', x)` NUNCA `.eq('email', x)`
- En RLS policies de PostgreSQL: `LOWER(email) = LOWER(auth.jwt() ->> 'email')`

### Queries con `.maybeSingle()` — CRÍTICO
- **SIEMPRE** agregar `.limit(1)` antes de `.maybeSingle()`
- **Por qué**: Si hay filas duplicadas, `.maybeSingle()` devuelve error `PGRST116` en vez de `null`.

### Logging en flujos críticos
- Para **autenticación** y flujos de login: usar `console.log/error/warn` directo, NO `logger`.
- **Por qué**: `logger` solo imprime cuando `import.meta.env.DEV === true`. En producción, los logs son silenciados.

### Herramienta Write vs Edit
- **SIEMPRE** usar el tool `Read` antes de `Write` o `Edit` en un archivo existente.
- Preferir `Edit` (diff parcial) sobre `Write` (reescritura completa) para archivos existentes.

---

## Lecciones Aprendidas (Improvement Loop)

Esta sección se actualiza automáticamente cuando Claude comete un error que el usuario debe corregir.

---

### Lección 1 — UUID inválido causa fallo silencioso en Supabase
**Qué pasó:** Se usaba `id: \`pay-${Date.now()}\`` como ID. Supabase rechaza el upsert porque la columna `id` es de tipo `uuid`. El catch block cerraba el modal silenciosamente.
**Causa raíz:** `crypto.randomUUID()` falla/cuelga en HTTP sin TLS. Se usó `Date.now()` como atajo.
**Regla derivada:** Usar siempre `generateUUID()` (función manual UUID v4). Ver función en sección "Guía de Estilo → IDs".
**Archivos afectados:** Cualquier componente que cree registros con ID para Supabase.

---

### Lección 2 — Comisión calculada dinámicamente rompe el historial
**Qué pasó (hipotético):** Si `commission_amt` se calcula al momento de consultar la BD usando el `commission_pct` actual del barbero, un cambio de comisión retroactivamente modifica todos los cortes históricos.
**Causa raíz:** No guardar el snapshot al momento del corte.
**Regla derivada:** `commission_pct` y `commission_amt` siempre se calculan y guardan al momento de registrar el corte. Son datos inmutables una vez guardados. Ver convención "Comisión" en Guía de Estilo.

---

### Lección 3 — Modales sin constraint de altura se cortan en móvil
**Qué pasó:** El modal "Registrar Pago" en `TenantsView.tsx` tenía `overflow-hidden` pero sin `max-h`. En pantallas móviles el contenido superaba la altura visible.
**Causa raíz:** El modal usaba `overflow-hidden` para bordes redondeados, sin considerar pantallas pequeñas.
**Regla derivada:** Todo modal con más de 4-5 campos DEBE usar el patrón `flex flex-col max-h-[90vh]` + body con `overflow-y-auto` + header/footer con `shrink-0`. Ver patrón en sección "Modales".

---

### Lección 4 — `netCashToHand` incorrecto al incluir pagos digitales
**Qué pasó (hipotético):** Si se suma `totalCard` al `netCashToHand`, el barbero reporta más efectivo del que realmente tiene y la caja no cierra.
**Causa raíz:** Confusión entre "revenue total" y "efectivo a entregar".
**Regla derivada:** `netCashToHand = totalCash - expensesCash`. La tarjeta y transferencia son ingresos del negocio pero NO pasan por el efectivo del barbero. Ver convención "netCashToHand".

---

### Lección 5 — Fallos de Supabase cerrados silenciosamente sin toast de error
**Qué pasó:** En catch blocks, el modal se cerraba sin mostrar mensaje de error al usuario.
**Causa raíz:** El catch block priorizaba "limpiar estado UI" sobre "informar al usuario".
**Regla derivada:** En todo catch block de operaciones Supabase, el `toast.error()` debe ser la PRIMERA instrucción. Nunca cerrar un modal en el catch si el error no fue resuelto.
```typescript
// ✅ Correcto
} catch (error: any) {
    toast.error(`Error: ${error?.message || 'Error desconocido'}`);
    // NO cerrar el modal — dejar al usuario reintentar
}
```

---

### Lección 6 — `logger` no imprime en producción (Vercel)
**Qué pasó:** Al debuggear login fallido en producción, la consola del navegador estaba completamente vacía.
**Causa raíz:** El flujo de auth usaba `logger.log()` que internamente chequea `import.meta.env.DEV`. En Vercel es `false`.
**Regla derivada:** Para flujos críticos (auth, login, pagos, cierres de turno), usar `console.log/error/warn` directo, NUNCA `logger`.

---

### Lección 7 — Sesión vinculada a cierre cerrado eliminada por error
**Qué pasó (hipotético):** Un admin elimina una sesión que ya fue incluida en un cierre de turno. El cierre muestra datos inconsistentes.
**Causa raíz:** No se verificó el `shiftClosingId` antes de permitir la eliminación.
**Regla derivada:** En `useSessions.deleteSession`, siempre verificar `session.shiftClosingId`. Si no es null, lanzar error. En la UI, ocultar el botón de eliminar si `session.shiftClosingId !== undefined`. Ver convención "Sesiones vinculadas a un cierre CERRADO son INMUTABLES".

---

### Lección 8 — Filtro de fecha compara timestamps completos (bug de zona horaria)
**Qué pasó (hipotético):** Al filtrar "cortes de hoy" comparando `session.startedAt === today` (donde today es `2026-03-28`), las sesiones de Argentina (GMT-3) pueden tener timestamp `2026-03-29T02:00:00Z` y no aparecer en el filtro.
**Causa raíz:** Los ISO timestamps en UTC no coinciden con la fecha local.
**Regla derivada:** SIEMPRE usar `session.startedAt.slice(0, 10)` para comparar fechas. Nunca comparar el timestamp completo en filtros de "por día". Ver convención "Cálculo de métricas".

---

### Lección 9 — Política RLS con recursión infinita en `barbers`
**Qué pasó:** Al cargar la app, todos los queries a Supabase fallan con error 500. En la consola aparece `42P17: infinite recursion detected in policy for relation "barbers"`. La app muestra "Error al cargar los datos" en un toast rojo.
**Causa raíz:** La política RLS de la tabla `barbers` hacía una subquery que volvía a leer la misma tabla `barbers`, disparando la política en un loop infinito. Puede ocurrir también si una tabla A tiene política que lee tabla B, y tabla B tiene política que lee tabla A.
**Regla derivada:** Al crear o sugerir políticas RLS para `barbers`:
- **NUNCA** hacer subquery a `barbers` dentro de una política de `barbers`.
- Para admins: usar `(auth.jwt() ->> 'email') IN (SELECT email FROM allowed_emails)`.
- Para barberos (self-access): usar `EXISTS (SELECT 1 FROM barber_auth WHERE barber_auth.user_id = auth.uid() AND barber_auth.barber_id = barbers.id)`.
- Al debuggear errores 500 de Supabase en carga inicial: primer sospechoso → políticas RLS recursivas.
- Fix: `DO $$ DECLARE r RECORD; BEGIN FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'barbers' LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON barbers'; END LOOP; END $$;`

---

### Lección 10 — Mapper envía columnas inexistentes en Supabase
**Qué pasó:** El modal "Nueva Barbería" lanzaba error al guardar: `Could not find the 'chair_count' column of 'barbershops' in the schema cache`. La barbería no se podía crear en absoluto.
**Causa raíz:** `barbershopToDb()` incluía `chair_count: null` y `opening_hours: null` en el payload de insert/upsert, pero esas columnas todavía no existían en la tabla (faltaba correr la migración SQL). Supabase rechaza el payload si contiene columnas que no existen en el schema.
**Regla derivada:** En mappers `*ToDb`, los campos opcionales que dependen de migraciones pendientes DEBEN omitirse si son `undefined`, no enviarse como `null`. Usar el patrón:
```typescript
if (shop.chairCount !== undefined) payload.chair_count = shop.chairCount;
```
NUNCA: `chair_count: shop.chairCount ?? null` para columnas que pueden no existir aún.

---

## Self-Improvement Loop — Instrucción para Claude

Cada vez que el usuario deba corregirte un error:
1. **Analiza** la causa raíz: ¿fue una suposición incorrecta, una función mal usada, un patrón omitido?
2. **Propone** una nueva regla concisa que prevenga ese error específico.
3. **Edita este archivo** añadiendo una nueva entrada en "Lecciones Aprendidas" con:
   - Título descriptivo
   - Qué pasó (síntoma observable)
   - Causa raíz
   - Regla derivada (accionable y específica)
   - Archivos afectados

No esperes que el usuario te pida que actualices el archivo — hazlo proactivamente después de cada corrección.
