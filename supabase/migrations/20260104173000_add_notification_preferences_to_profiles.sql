-- Add email notification preferences to profiles
-- JSONB shape:
-- { "new_comments": true, "event_updates": true, "event_reminders": true }

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS notification_preferences jsonb
NOT NULL
DEFAULT '{"new_comments": true, "event_updates": true, "event_reminders": true}'::jsonb;

-- Ensure users can update their own profile row (including notification_preferences).
-- Most environments already have this policy; this is a safety net.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Users can update their own profile'
  ) THEN
    CREATE POLICY "Users can update their own profile"
      ON public.profiles
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;


