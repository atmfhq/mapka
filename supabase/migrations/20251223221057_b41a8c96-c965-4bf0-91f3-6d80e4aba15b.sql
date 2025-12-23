-- Fix passive realtime by enabling publication + replica identity and opening read access for map-only profile rows

-- 1) Ensure UPDATE payloads include full rows (helps client-side merging and avoids partial data)
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.megaphones REPLICA IDENTITY FULL;
ALTER TABLE public.event_participants REPLICA IDENTITY FULL;

-- 2) Ensure tables are included in realtime publication (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'profiles'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'megaphones'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.megaphones';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'event_participants'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.event_participants';
  END IF;
END $$;

-- 3) Open READ (SELECT) for map visualization while keeping write rules unchanged
-- Note: profiles table contains no email/phone fields; we still restrict rows to active+onboarded+located.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Public can view map profiles'
  ) THEN
    EXECUTE '
      CREATE POLICY "Public can view map profiles"
      ON public.profiles
      FOR SELECT
      TO anon, authenticated
      USING (
        is_active = true
        AND COALESCE(is_onboarded, false) = true
        AND location_lat IS NOT NULL
        AND location_lng IS NOT NULL
      )
    ';
  END IF;
END $$;