-- Allow realtime (and normal SELECT) to deliver other users' location updates.
-- Without this, clients can only see their own profile row, so passive observation won't work.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Authenticated users can view active location profiles'
  ) THEN
    CREATE POLICY "Authenticated users can view active location profiles"
    ON public.profiles
    FOR SELECT
    USING (
      auth.uid() IS NOT NULL
      AND is_active = true
      AND location_lat IS NOT NULL
      AND location_lng IS NOT NULL
      AND COALESCE(is_onboarded, false) = true
    );
  END IF;
END $$;