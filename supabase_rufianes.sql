-- ═══════════════════════════════════════════════════════════════════════════
-- RUFIANES BARBERSHOP — Schema Supabase
-- Ejecutar en el SQL Editor del proyecto: bqfgbflqzgftquuthbco.supabase.co
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── EXTENSIONES ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── TABLA: allowed_emails ────────────────────────────────────────────────────
-- Admins con acceso total al sistema
CREATE TABLE IF NOT EXISTS allowed_emails (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar el admin dueño
INSERT INTO allowed_emails (email) VALUES ('juan.sada98@gmail.com')
ON CONFLICT (email) DO NOTHING;

-- ─── TABLA: barbershops ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS barbershops (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  address      TEXT NOT NULL,
  coordinates  JSONB NOT NULL,             -- [lat, lng] ej: [-34.603, -58.381]
  neighborhood TEXT,
  phone        TEXT,
  image_url    TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  manager_name TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TABLA: barbers ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS barbers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id   UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  phone           TEXT,
  email           TEXT,               -- para login con Google OAuth
  photo_url       TEXT,
  specialties     TEXT[] DEFAULT '{}',
  commission_pct  NUMERIC(5,2) NOT NULL DEFAULT 50.00,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  hire_date       DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para búsquedas por email (case-insensitive)
CREATE INDEX IF NOT EXISTS barbers_email_idx ON barbers (LOWER(email));

-- ─── TABLA: barber_auth ───────────────────────────────────────────────────────
-- Mapea auth.users.id → barbers.id para el login del barbero
CREATE TABLE IF NOT EXISTS barber_auth (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  barber_id  UUID NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TABLA: services ─────────────────────────────────────────────────────────
-- Catálogo de servicios. barbershop_id = NULL significa servicio global.
CREATE TABLE IF NOT EXISTS services (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id   UUID REFERENCES barbershops(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  base_price      NUMERIC(10,2) NOT NULL,
  duration_mins   INTEGER NOT NULL DEFAULT 30,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Servicios globales por defecto (barbershop_id = NULL)
INSERT INTO services (name, base_price, duration_mins) VALUES
  ('Corte clásico',  3500, 30),
  ('Fade',           4500, 40),
  ('Corte + Barba',  5500, 50),
  ('Barba',          2500, 20),
  ('Degradado',      4000, 35),
  ('Corte Niño',     2800, 25),
  ('Alisado',        6000, 60),
  ('Tintura',        5000, 45)
ON CONFLICT DO NOTHING;

-- ─── TABLA: clients ──────────────────────────────────────────────────────────
-- Clientes frecuentes (opcional — pueden registrarse por nombre al momento del corte)
CREATE TABLE IF NOT EXISTS clients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id   UUID REFERENCES barbershops(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  phone           TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TABLA: shift_closings ───────────────────────────────────────────────────
-- Un barbero puede tener un cierre OPEN por día. Al cerrarlo queda CLOSED.
CREATE TABLE IF NOT EXISTS shift_closings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id     UUID NOT NULL REFERENCES barbershops(id),
  barber_id         UUID NOT NULL REFERENCES barbers(id),
  shift_date        DATE NOT NULL,
  started_at        TIMESTAMPTZ,
  closed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_cuts        INTEGER NOT NULL DEFAULT 0,
  total_cash        NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_card        NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_transfer    NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_revenue     NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_commission  NUMERIC(10,2) NOT NULL DEFAULT 0,
  expenses_cash     NUMERIC(10,2) NOT NULL DEFAULT 0,
  expenses_detail   JSONB NOT NULL DEFAULT '[]',  -- [{description, amount}]
  net_cash_to_hand  NUMERIC(10,2),
  notes             TEXT,
  status            TEXT NOT NULL DEFAULT 'OPEN'
                    CHECK (status IN ('OPEN', 'CLOSED')),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Un barbero solo puede tener un cierre OPEN por día
CREATE UNIQUE INDEX IF NOT EXISTS shift_closings_open_per_barber_day
  ON shift_closings (barber_id, shift_date)
  WHERE status = 'OPEN';

-- ─── TABLA: haircut_sessions ─────────────────────────────────────────────────
-- Cada corte de pelo registrado. commission_pct y commission_amt son snapshots.
CREATE TABLE IF NOT EXISTS haircut_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id    UUID NOT NULL REFERENCES barbershops(id),
  barber_id        UUID NOT NULL REFERENCES barbers(id),
  client_id        UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_name      TEXT,            -- denormalizado para entrada rápida
  service_id       UUID REFERENCES services(id) ON DELETE SET NULL,
  service_name     TEXT NOT NULL,   -- snapshot del nombre
  price            NUMERIC(10,2) NOT NULL,
  commission_pct   NUMERIC(5,2) NOT NULL,   -- snapshot del % al momento del corte
  commission_amt   NUMERIC(10,2) NOT NULL,  -- price * commission_pct / 100
  payment_method   TEXT NOT NULL CHECK (payment_method IN ('CASH', 'CARD', 'TRANSFER')),
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at         TIMESTAMPTZ,
  duration_mins    INTEGER,
  shift_closing_id UUID REFERENCES shift_closings(id) ON DELETE SET NULL,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para queries frecuentes
CREATE INDEX IF NOT EXISTS sessions_barber_date_idx ON haircut_sessions (barber_id, started_at);
CREATE INDEX IF NOT EXISTS sessions_barbershop_date_idx ON haircut_sessions (barbershop_id, started_at);
CREATE INDEX IF NOT EXISTS sessions_shift_closing_idx ON haircut_sessions (shift_closing_id);

-- ─── TABLA: notifications ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email  TEXT NOT NULL,
  title            TEXT NOT NULL,
  message          TEXT NOT NULL,
  type             TEXT NOT NULL DEFAULT 'GENERAL',
  related_id       UUID,
  read             BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════════════════

-- Habilitar RLS en todas las tablas
ALTER TABLE barbershops      ENABLE ROW LEVEL SECURITY;
ALTER TABLE barbers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE barber_auth      ENABLE ROW LEVEL SECURITY;
ALTER TABLE services         ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients          ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_closings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE haircut_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications    ENABLE ROW LEVEL SECURITY;
ALTER TABLE allowed_emails   ENABLE ROW LEVEL SECURITY;

-- ─── Helper: verificar si el usuario autenticado es ADMIN ─────────────────────
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM allowed_emails
    WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email')
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- ─── Helper: obtener el barber_id del usuario autenticado ────────────────────
CREATE OR REPLACE FUNCTION get_my_barber_id()
RETURNS UUID AS $$
  SELECT barber_id FROM barber_auth WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- ─── POLICIES: allowed_emails ────────────────────────────────────────────────
CREATE POLICY "Admin lee allowed_emails" ON allowed_emails
  FOR SELECT TO authenticated USING (is_admin());

-- ─── POLICIES: barbershops ────────────────────────────────────────────────────
CREATE POLICY "Admin CRUD barbershops" ON barbershops
  FOR ALL TO authenticated USING (is_admin());

CREATE POLICY "Barber lee su barbershop" ON barbershops
  FOR SELECT TO authenticated
  USING (id = (SELECT b.barbershop_id FROM barbers b WHERE b.id = get_my_barber_id()));

-- ─── POLICIES: barbers ────────────────────────────────────────────────────────
CREATE POLICY "Admin CRUD barbers" ON barbers
  FOR ALL TO authenticated USING (is_admin());

CREATE POLICY "Barber lee barberos de su local" ON barbers
  FOR SELECT TO authenticated
  USING (barbershop_id = (SELECT b.barbershop_id FROM barbers b WHERE b.id = get_my_barber_id()));

-- ─── POLICIES: barber_auth ────────────────────────────────────────────────────
CREATE POLICY "Admin CRUD barber_auth" ON barber_auth
  FOR ALL TO authenticated USING (is_admin());

CREATE POLICY "Barber lee su propia auth" ON barber_auth
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ─── POLICIES: services ───────────────────────────────────────────────────────
CREATE POLICY "Admin CRUD services" ON services
  FOR ALL TO authenticated USING (is_admin());

CREATE POLICY "Barber lee servicios de su local" ON services
  FOR SELECT TO authenticated
  USING (
    barbershop_id IS NULL OR
    barbershop_id = (SELECT b.barbershop_id FROM barbers b WHERE b.id = get_my_barber_id())
  );

-- ─── POLICIES: clients ───────────────────────────────────────────────────────
CREATE POLICY "Admin CRUD clients" ON clients
  FOR ALL TO authenticated USING (is_admin());

CREATE POLICY "Barber lee clientes de su local" ON clients
  FOR SELECT TO authenticated
  USING (
    barbershop_id IS NULL OR
    barbershop_id = (SELECT b.barbershop_id FROM barbers b WHERE b.id = get_my_barber_id())
  );

CREATE POLICY "Barber inserta clientes" ON clients
  FOR INSERT TO authenticated
  WITH CHECK (is_admin() OR barbershop_id = (SELECT b.barbershop_id FROM barbers b WHERE b.id = get_my_barber_id()));

-- ─── POLICIES: haircut_sessions ───────────────────────────────────────────────
CREATE POLICY "Admin CRUD sessions" ON haircut_sessions
  FOR ALL TO authenticated USING (is_admin());

CREATE POLICY "Barber lee sus propias sesiones" ON haircut_sessions
  FOR SELECT TO authenticated USING (barber_id = get_my_barber_id());

CREATE POLICY "Barber inserta sus propias sesiones" ON haircut_sessions
  FOR INSERT TO authenticated
  WITH CHECK (barber_id = get_my_barber_id());

CREATE POLICY "Barber actualiza sesiones no cerradas" ON haircut_sessions
  FOR UPDATE TO authenticated
  USING (barber_id = get_my_barber_id() AND shift_closing_id IS NULL);

-- ─── POLICIES: shift_closings ────────────────────────────────────────────────
CREATE POLICY "Admin CRUD shift_closings" ON shift_closings
  FOR ALL TO authenticated USING (is_admin());

CREATE POLICY "Barber CRUD sus propios cierres" ON shift_closings
  FOR ALL TO authenticated USING (barber_id = get_my_barber_id());

-- ─── POLICIES: notifications ─────────────────────────────────────────────────
CREATE POLICY "Admin lee todas las notificaciones" ON notifications
  FOR ALL TO authenticated USING (is_admin());

CREATE POLICY "Usuario lee sus notificaciones" ON notifications
  FOR SELECT TO authenticated
  USING (LOWER(recipient_email) = LOWER(auth.jwt() ->> 'email'));

CREATE POLICY "Usuario marca sus notificaciones como leídas" ON notifications
  FOR UPDATE TO authenticated
  USING (LOWER(recipient_email) = LOWER(auth.jwt() ->> 'email'));

-- ═══════════════════════════════════════════════════════════════════════════
-- REALTIME
-- Habilitar realtime en las tablas que lo necesitan
-- ═══════════════════════════════════════════════════════════════════════════
-- Ejecutar en Dashboard → Database → Replication → Tables
-- Activar: haircut_sessions, shift_closings, notifications

-- ═══════════════════════════════════════════════════════════════════════════
-- SEED: 8 Barberías Rufianes (COMPLETAR con coordenadas reales)
-- ═══════════════════════════════════════════════════════════════════════════
/*
INSERT INTO barbershops (name, address, coordinates, neighborhood, is_active) VALUES
  ('Rufianes Palermo',     'Av. Santa Fe 3454, Palermo',       '[-34.5884, -58.4094]', 'Palermo',        TRUE),
  ('Rufianes Belgrano',    'Av. Cabildo 2180, Belgrano',       '[-34.5601, -58.4574]', 'Belgrano',       TRUE),
  ('Rufianes Caballito',   'Av. Rivadavia 5012, Caballito',    '[-34.6181, -58.4396]', 'Caballito',      TRUE),
  ('Rufianes San Telmo',   'Defensa 890, San Telmo',           '[-34.6217, -58.3730]', 'San Telmo',      TRUE),
  ('Rufianes Flores',      'Av. Rivadavia 7301, Flores',       '[-34.6289, -58.4743]', 'Flores',         TRUE),
  ('Rufianes Villa Urquiza', 'Av. Triunvirato 4550, V. Urquiza', '[-34.5726, -58.4926]', 'Villa Urquiza',  TRUE),
  ('Rufianes Boedo',       'Av. San Juan 3453, Boedo',         '[-34.6346, -58.4127]', 'Boedo',          TRUE),
  ('Rufianes Recoleta',    'Av. Callao 1245, Recoleta',        '[-34.5940, -58.3924]', 'Recoleta',       TRUE);
*/
