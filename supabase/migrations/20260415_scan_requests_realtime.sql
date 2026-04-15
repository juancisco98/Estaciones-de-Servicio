-- Habilita realtime sobre scan_requests para que el dashboard reciba el cambio
-- de estado (pending → processing → completed/failed) instantáneamente, sin
-- depender de polling cada 3s.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM   pg_publication_tables
        WHERE  pubname    = 'supabase_realtime'
          AND  schemaname = 'public'
          AND  tablename  = 'scan_requests'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.scan_requests;
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
