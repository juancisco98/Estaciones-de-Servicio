-- Add turno and area_code to sales_transactions (from VE parser)
ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS turno INT;
ALTER TABLE sales_transactions ADD COLUMN IF NOT EXISTS area_code INT;

-- Add turno to daily_closings (from P/S parsers) + change UNIQUE key
ALTER TABLE daily_closings ADD COLUMN IF NOT EXISTS turno INT;
ALTER TABLE daily_closings DROP CONSTRAINT IF EXISTS daily_closings_station_id_shift_date_key;
ALTER TABLE daily_closings ADD CONSTRAINT daily_closings_station_turno_key
  UNIQUE (station_id, shift_date, turno);

-- Dynamic tank IDs: accept any TQ1-TQ99 (no hardcoded list)
ALTER TABLE tank_levels DROP CONSTRAINT IF EXISTS tank_levels_tank_id_check;
ALTER TABLE tank_levels ADD CONSTRAINT tank_levels_tank_id_check
  CHECK (tank_id ~ '^TQ[0-9]{1,2}$');
