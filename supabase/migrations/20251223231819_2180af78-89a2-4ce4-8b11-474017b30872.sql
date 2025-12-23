-- Ensure realtime is enabled for public.profiles (idempotent) and that UPDATE events contain full row data
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
EXCEPTION
  WHEN duplicate_object THEN
    -- already a member of the publication
    NULL;
END $$;

ALTER TABLE public.profiles REPLICA IDENTITY FULL;