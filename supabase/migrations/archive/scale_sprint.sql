-- ============================================================
-- SPRINT DE ESCALABILIDAD — Rufianes
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. ÍNDICES DE PERFORMANCE ──────────────────────────────
-- Aceleran las queries filtradas por barbershop/barber + fecha
-- (reducen full-table-scans en tablas con 100k+ filas)

CREATE INDEX IF NOT EXISTS idx_sessions_barbershop_date
    ON haircut_sessions(barbershop_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_barber_date
    ON haircut_sessions(barber_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_closings_barbershop_date
    ON shift_closings(barbershop_id, shift_date DESC);

CREATE INDEX IF NOT EXISTS idx_closings_barber_date
    ON shift_closings(barber_id, shift_date DESC);

CREATE INDEX IF NOT EXISTS idx_barber_auth_user
    ON barber_auth(user_id);


-- ── 2. RLS EN haircut_sessions ─────────────────────────────
-- Admins: acceso total
-- Barberos: solo ven/crean/editan sesiones de su barbería

ALTER TABLE haircut_sessions ENABLE ROW LEVEL SECURITY;

-- Admins (via allowed_emails)
CREATE POLICY "sessions_admin_all"
    ON haircut_sessions
    FOR ALL
    TO authenticated
    USING (
        (auth.jwt() ->> 'email') IN (SELECT email FROM allowed_emails)
    );

-- Barberos: SELECT solo su barbería
CREATE POLICY "sessions_barber_select"
    ON haircut_sessions
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM barber_auth ba
            JOIN barbers b ON b.id = ba.barber_id
            WHERE ba.user_id = auth.uid()
              AND b.barbershop_id = haircut_sessions.barbershop_id
        )
    );

-- Barberos: INSERT solo en su barbería y con su barber_id
CREATE POLICY "sessions_barber_insert"
    ON haircut_sessions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM barber_auth ba
            WHERE ba.user_id = auth.uid()
              AND ba.barber_id = haircut_sessions.barber_id
        )
    );

-- Barberos: UPDATE solo sus propias sesiones (abiertas)
CREATE POLICY "sessions_barber_update"
    ON haircut_sessions
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM barber_auth ba
            WHERE ba.user_id = auth.uid()
              AND ba.barber_id = haircut_sessions.barber_id
        )
    );


-- ── 3. RLS EN shift_closings ───────────────────────────────
-- Admins: acceso total
-- Barberos: solo ven/crean/editan sus propios cierres

ALTER TABLE shift_closings ENABLE ROW LEVEL SECURITY;

-- Admins
CREATE POLICY "closings_admin_all"
    ON shift_closings
    FOR ALL
    TO authenticated
    USING (
        (auth.jwt() ->> 'email') IN (SELECT email FROM allowed_emails)
    );

-- Barberos: SELECT solo sus cierres
CREATE POLICY "closings_barber_select"
    ON shift_closings
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM barber_auth ba
            WHERE ba.user_id = auth.uid()
              AND ba.barber_id = shift_closings.barber_id
        )
    );

-- Barberos: INSERT sus propios cierres
CREATE POLICY "closings_barber_insert"
    ON shift_closings
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM barber_auth ba
            WHERE ba.user_id = auth.uid()
              AND ba.barber_id = shift_closings.barber_id
        )
    );

-- Barberos: UPDATE sus propios cierres
CREATE POLICY "closings_barber_update"
    ON shift_closings
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM barber_auth ba
            WHERE ba.user_id = auth.uid()
              AND ba.barber_id = shift_closings.barber_id
        )
    );
