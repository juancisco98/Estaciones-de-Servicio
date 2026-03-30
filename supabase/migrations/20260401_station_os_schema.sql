-- ============================================================
-- Station-OS: Complete Database Schema
-- Migration: 20260401_station_os_schema.sql
-- Run this in the Supabase SQL editor (paste and click Run)
-- ============================================================

-- ─── EXTENSIONS ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── ENUM TYPES ──────────────────────────────────────────────────────────────
CREATE TYPE employee_role       AS ENUM ('MANAGER', 'ATTENDANT', 'CASHIER');
CREATE TYPE payment_method_type AS ENUM ('CASH', 'CARD', 'ACCOUNT', 'MODO', 'MERCADOPAGO');
CREATE TYPE closing_status      AS ENUM ('PENDING', 'RECONCILED', 'DISCREPANCY');
CREATE TYPE alert_level         AS ENUM ('CRITICAL', 'WARNING', 'INFO');
CREATE TYPE alert_type          AS ENUM (
    'CASH_DISCREPANCY',
    'NEGATIVE_VALUE',
    'MISSING_FILE',
    'LOW_TANK_LEVEL',
    'CRITICAL_TANK_LEVEL',
    'RECONCILIATION_FAIL',
    'UNKNOWN_PRODUCT',
    'VOLUME_ANOMALY',
    'MISSING_TRANSACTIONS'
);

-- ─── TABLE: allowed_emails ───────────────────────────────────────────────────
-- Whitelist del dueño/administradores. Solo los emails aquí pueden entrar.
CREATE TABLE IF NOT EXISTS allowed_emails (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email      TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insertar el email del dueño directamente:
-- INSERT INTO allowed_emails (email) VALUES ('juan.sada98@gmail.com');

-- ─── TABLE: notifications ────────────────────────────────────────────────────
-- Notificaciones UI para el dueño.
CREATE TABLE IF NOT EXISTS notifications (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title      TEXT NOT NULL,
    message    TEXT,
    type       TEXT NOT NULL DEFAULT 'INFO',
    read       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── TABLE: stations ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    address         TEXT NOT NULL,
    coordinates     NUMERIC(10,6)[] NOT NULL,
    city            TEXT,
    province        TEXT,
    phone           TEXT,
    manager_name    TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    station_code    TEXT UNIQUE,       -- e.g. "EST_001", matches C:\SVAPP subfolder
    watch_path      TEXT,              -- e.g. "C:\SVAPP\EST_001"
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stations_active ON stations(is_active);
CREATE INDEX idx_stations_code   ON stations(station_code);

-- ─── TABLE: employees ────────────────────────────────────────────────────────
-- Personal de cada estación (solo para referencia — no tienen login).
CREATE TABLE IF NOT EXISTS employees (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id      UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    email           TEXT,
    role            employee_role NOT NULL DEFAULT 'ATTENDANT',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    hire_date       DATE,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_employees_station ON employees(station_id);
CREATE INDEX idx_employees_email   ON employees(LOWER(email));

-- ─── TABLE: daily_closings ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_closings (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id            UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    shift_date            DATE NOT NULL,
    forecourt_total       NUMERIC(14,2),
    shop_total            NUMERIC(14,2),
    transactions_total    NUMERIC(14,2),
    reconciliation_diff   NUMERIC(14,2),
    reconciliation_ok     BOOLEAN NOT NULL DEFAULT FALSE,
    p_file_name           TEXT,
    s_file_name           TEXT,
    status                closing_status NOT NULL DEFAULT 'PENDING',
    notes                 TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (station_id, shift_date)
);

CREATE INDEX idx_daily_closings_station_date ON daily_closings(station_id, shift_date DESC);
CREATE INDEX idx_daily_closings_status       ON daily_closings(status);

-- ─── TABLE: sales_transactions ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales_transactions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id          UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    file_name           TEXT NOT NULL,
    transaction_ts      TIMESTAMPTZ NOT NULL,
    product_code        TEXT NOT NULL,
    product_name        TEXT NOT NULL,
    quantity            NUMERIC(12,3) NOT NULL,
    unit_price          NUMERIC(12,4) NOT NULL,
    total_amount        NUMERIC(14,2) NOT NULL,
    payment_method      payment_method_type,
    shift_date          DATE NOT NULL,
    daily_closing_id    UUID REFERENCES daily_closings(id),
    raw_line            TEXT,
    ingested_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sales_station_date ON sales_transactions(station_id, shift_date DESC);
CREATE INDEX idx_sales_product_code ON sales_transactions(product_code);
CREATE INDEX idx_sales_file_name    ON sales_transactions(file_name);
CREATE INDEX idx_sales_closing      ON sales_transactions(daily_closing_id);

-- ─── TABLE: card_payments ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS card_payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id      UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    file_name       TEXT NOT NULL,
    payment_ts      TIMESTAMPTZ NOT NULL,
    payment_type    payment_method_type NOT NULL,
    account_name    TEXT,
    amount          NUMERIC(14,2) NOT NULL,
    reference_code  TEXT,
    shift_date      DATE NOT NULL,
    daily_closing_id UUID REFERENCES daily_closings(id),
    raw_line        TEXT,
    ingested_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_card_payments_station_date ON card_payments(station_id, shift_date DESC);
CREATE INDEX idx_card_payments_type         ON card_payments(payment_type);

-- ─── TABLE: tank_levels ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tank_levels (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id       UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    file_name        TEXT NOT NULL,
    recorded_at      TIMESTAMPTZ NOT NULL,
    tank_id          TEXT NOT NULL CHECK (tank_id IN ('TQ1','TQ2','TQ3','TQ4','TQ5')),
    product_code     TEXT NOT NULL,
    product_name     TEXT NOT NULL,
    level_liters     NUMERIC(12,3) NOT NULL,
    capacity_liters  NUMERIC(12,3),
    raw_line         TEXT,
    ingested_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tank_levels_station_time ON tank_levels(station_id, recorded_at DESC);
CREATE INDEX idx_tank_levels_tank_id      ON tank_levels(station_id, tank_id);

-- ─── TABLE: alerts ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id      UUID REFERENCES stations(id) ON DELETE CASCADE,
    level           alert_level NOT NULL,
    type            alert_type NOT NULL,
    title           TEXT NOT NULL,
    message         TEXT NOT NULL,
    related_date    DATE,
    related_file    TEXT,
    resolved        BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at     TIMESTAMPTZ,
    resolved_by     TEXT,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_alerts_station_unresolved ON alerts(station_id, resolved, created_at DESC);
CREATE INDEX idx_alerts_level_unresolved   ON alerts(level, resolved);

-- ─── TABLE: station_knowledge ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS station_knowledge (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id      UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE UNIQUE,
    knowledge_blob  JSONB NOT NULL DEFAULT '{
        "schema_version": 1,
        "products": {},
        "payment_accounts": {},
        "anomaly_baselines": {
            "daily_fuel_liters_p50": 4500,
            "cash_variance_tolerance_pct": 0.1,
            "min_tank_alert_liters": 800,
            "critical_tank_liters": 300
        },
        "unknown_product_codes": [],
        "unknown_account_names": []
    }',
    version         INTEGER NOT NULL DEFAULT 1,
    last_updated    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── UPDATED_AT TRIGGER ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_stations_updated_at
    BEFORE UPDATE ON stations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_closings_updated_at
    BEFORE UPDATE ON daily_closings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE allowed_emails      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE stations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_payments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tank_levels         ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_closings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE station_knowledge   ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user the owner/admin?
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM allowed_emails
        WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email')
    );
$$;

-- ── Policies: solo el dueño (admin) tiene acceso completo ────────────────────

CREATE POLICY "Admin full access" ON allowed_emails     FOR ALL USING (is_admin());
CREATE POLICY "Admin full access" ON notifications      FOR ALL USING (is_admin());
CREATE POLICY "Admin full access" ON stations           FOR ALL USING (is_admin());
CREATE POLICY "Admin full access" ON employees          FOR ALL USING (is_admin());
CREATE POLICY "Admin full access" ON sales_transactions FOR ALL USING (is_admin());
CREATE POLICY "Admin full access" ON card_payments      FOR ALL USING (is_admin());
CREATE POLICY "Admin full access" ON tank_levels        FOR ALL USING (is_admin());
CREATE POLICY "Admin full access" ON daily_closings     FOR ALL USING (is_admin());
CREATE POLICY "Admin full access" ON alerts             FOR ALL USING (is_admin());
CREATE POLICY "Admin full access" ON station_knowledge  FOR ALL USING (is_admin());

-- ─── AFTER RUNNING: insert your email ────────────────────────────────────────
-- Uncomment and run this separately after the schema is created:
-- INSERT INTO allowed_emails (email) VALUES ('tu-email@gmail.com');
