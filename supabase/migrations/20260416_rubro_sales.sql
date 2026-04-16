-- Rubro sales: category-level breakdown from RP*.TXT (playa) and RS*.TXT (salon)
CREATE TABLE IF NOT EXISTS rubro_sales (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id     UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    shift_date     DATE NOT NULL,
    turno          INTEGER NOT NULL,
    source_type    TEXT NOT NULL CHECK (source_type IN ('RP', 'RS')),
    rubro_id       TEXT NOT NULL,
    rubro_name     TEXT NOT NULL,
    quantity       INTEGER NOT NULL DEFAULT 0,
    amount         NUMERIC(14,2) NOT NULL DEFAULT 0,
    file_name      TEXT NOT NULL,
    raw_line       TEXT,
    ingested_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (station_id, shift_date, turno, source_type, rubro_id, rubro_name)
);

CREATE INDEX IF NOT EXISTS idx_rubro_sales_station_date
    ON rubro_sales(station_id, shift_date DESC);

-- RLS
ALTER TABLE rubro_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmin full access" ON rubro_sales
    FOR ALL USING (is_superadmin());

CREATE POLICY "Owner access" ON rubro_sales
    FOR ALL
    USING (station_id IN (SELECT my_station_ids()))
    WITH CHECK (station_id IN (SELECT my_station_ids()));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE rubro_sales;
