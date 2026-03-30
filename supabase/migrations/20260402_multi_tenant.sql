-- ============================================================
-- Station-OS: Multi-Tenant Migration
-- Migration: 20260402_multi_tenant.sql
-- Run this AFTER 20260401_station_os_schema.sql
-- ============================================================

-- ─── 1. ADD COLUMNS ─────────────────────────────────────────────────────────

-- Superadmin flag for Juan (can see all clients' data)
ALTER TABLE allowed_emails
    ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN NOT NULL DEFAULT FALSE;

-- Tenant key: which owner owns this station
ALTER TABLE stations
    ADD COLUMN IF NOT EXISTS owner_email TEXT;

-- Notifications scoped to recipient
ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS recipient_email TEXT;

-- ─── 2. BACKFILL EXISTING DATA ──────────────────────────────────────────────

-- Mark Juan as superadmin
UPDATE allowed_emails
SET is_superadmin = TRUE
WHERE LOWER(email) = 'juan.sada98@gmail.com';

-- Assign all existing stations to Juan
UPDATE stations
SET owner_email = 'juan.sada98@gmail.com'
WHERE owner_email IS NULL;

-- Now enforce NOT NULL
ALTER TABLE stations
    ALTER COLUMN owner_email SET NOT NULL;

-- ─── 3. INDEXES ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_stations_owner_email
    ON stations(LOWER(owner_email));

CREATE INDEX IF NOT EXISTS idx_notifications_recipient
    ON notifications(LOWER(recipient_email));

-- ─── 4. DROP OLD RLS POLICIES & FUNCTIONS ───────────────────────────────────

DO $$
DECLARE pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname, tablename FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN (
              'allowed_emails', 'notifications', 'stations', 'employees',
              'sales_transactions', 'card_payments', 'tank_levels',
              'daily_closings', 'alerts', 'station_knowledge'
          )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

DROP FUNCTION IF EXISTS is_admin();

-- ─── 5. NEW RLS HELPER FUNCTIONS ────────────────────────────────────────────

-- Is the current user a superadmin? (Juan)
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM allowed_emails
        WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email')
          AND is_superadmin = TRUE
    );
$$;

-- Is the current user a registered owner?
CREATE OR REPLACE FUNCTION is_owner()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM allowed_emails
        WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email')
    );
$$;

-- Returns station IDs owned by the current user
CREATE OR REPLACE FUNCTION my_station_ids()
RETURNS SETOF UUID
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
    SELECT id FROM stations
    WHERE LOWER(owner_email) = LOWER(auth.jwt() ->> 'email');
$$;

-- ─── 6. NEW RLS POLICIES ───────────────────────────────────────────────────

-- ── allowed_emails ──
CREATE POLICY "Superadmin full access"
    ON allowed_emails FOR ALL
    USING (is_superadmin());

CREATE POLICY "Owner reads own email"
    ON allowed_emails FOR SELECT
    USING (LOWER(email) = LOWER(auth.jwt() ->> 'email'));

-- ── stations ──
CREATE POLICY "Superadmin full access"
    ON stations FOR ALL
    USING (is_superadmin());

CREATE POLICY "Owner sees own stations"
    ON stations FOR SELECT
    USING (LOWER(owner_email) = LOWER(auth.jwt() ->> 'email'));

CREATE POLICY "Owner updates own stations"
    ON stations FOR UPDATE
    USING (LOWER(owner_email) = LOWER(auth.jwt() ->> 'email'))
    WITH CHECK (LOWER(owner_email) = LOWER(auth.jwt() ->> 'email'));

-- ── employees ──
CREATE POLICY "Superadmin full access"
    ON employees FOR ALL
    USING (is_superadmin());

CREATE POLICY "Owner access"
    ON employees FOR ALL
    USING (station_id IN (SELECT my_station_ids()))
    WITH CHECK (station_id IN (SELECT my_station_ids()));

-- ── sales_transactions ──
CREATE POLICY "Superadmin full access"
    ON sales_transactions FOR ALL
    USING (is_superadmin());

CREATE POLICY "Owner access"
    ON sales_transactions FOR ALL
    USING (station_id IN (SELECT my_station_ids()))
    WITH CHECK (station_id IN (SELECT my_station_ids()));

-- ── card_payments ──
CREATE POLICY "Superadmin full access"
    ON card_payments FOR ALL
    USING (is_superadmin());

CREATE POLICY "Owner access"
    ON card_payments FOR ALL
    USING (station_id IN (SELECT my_station_ids()))
    WITH CHECK (station_id IN (SELECT my_station_ids()));

-- ── tank_levels ──
CREATE POLICY "Superadmin full access"
    ON tank_levels FOR ALL
    USING (is_superadmin());

CREATE POLICY "Owner access"
    ON tank_levels FOR ALL
    USING (station_id IN (SELECT my_station_ids()))
    WITH CHECK (station_id IN (SELECT my_station_ids()));

-- ── daily_closings ──
CREATE POLICY "Superadmin full access"
    ON daily_closings FOR ALL
    USING (is_superadmin());

CREATE POLICY "Owner access"
    ON daily_closings FOR ALL
    USING (station_id IN (SELECT my_station_ids()))
    WITH CHECK (station_id IN (SELECT my_station_ids()));

-- ── alerts ──
CREATE POLICY "Superadmin full access"
    ON alerts FOR ALL
    USING (is_superadmin());

CREATE POLICY "Owner access"
    ON alerts FOR ALL
    USING (station_id IN (SELECT my_station_ids()))
    WITH CHECK (station_id IN (SELECT my_station_ids()));

-- ── station_knowledge ──
CREATE POLICY "Superadmin full access"
    ON station_knowledge FOR ALL
    USING (is_superadmin());

CREATE POLICY "Owner access"
    ON station_knowledge FOR ALL
    USING (station_id IN (SELECT my_station_ids()))
    WITH CHECK (station_id IN (SELECT my_station_ids()));

-- ── notifications ──
CREATE POLICY "Superadmin full access"
    ON notifications FOR ALL
    USING (is_superadmin());

CREATE POLICY "Recipient sees own"
    ON notifications FOR SELECT
    USING (LOWER(recipient_email) = LOWER(auth.jwt() ->> 'email'));

CREATE POLICY "Recipient updates own"
    ON notifications FOR UPDATE
    USING (LOWER(recipient_email) = LOWER(auth.jwt() ->> 'email'));

-- ─── 7. SHIFT NUMBER FUNCTION ───────────────────────────────────────────────

-- Returns shift number based on timestamp:
-- 1 = 06:00–13:59 (Turno Mañana)
-- 2 = 14:00–21:59 (Turno Tarde)
-- 3 = 22:00–05:59 (Turno Noche)
CREATE OR REPLACE FUNCTION get_shift_number(ts TIMESTAMPTZ)
RETURNS INTEGER
LANGUAGE sql IMMUTABLE
AS $$
    SELECT CASE
        WHEN EXTRACT(HOUR FROM ts) >= 6  AND EXTRACT(HOUR FROM ts) < 14 THEN 1
        WHEN EXTRACT(HOUR FROM ts) >= 14 AND EXTRACT(HOUR FROM ts) < 22 THEN 2
        ELSE 3
    END;
$$;
