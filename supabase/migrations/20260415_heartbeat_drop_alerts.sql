-- 1. Heartbeat del edge agent por estación.
ALTER TABLE stations
    ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_stations_heartbeat
    ON stations (last_heartbeat);

-- 2. Eliminación definitiva de alertas (los dueños no las quieren).
-- CASCADE por si hay FKs desde alert_rules u otras tablas derivadas.
DROP TABLE IF EXISTS alerts CASCADE;

NOTIFY pgrst, 'reload schema';
