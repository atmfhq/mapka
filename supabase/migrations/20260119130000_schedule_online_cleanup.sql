-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;

-- Schedule cleanup_stale_online_users to run every minute
-- This marks users as offline if they haven't sent a heartbeat in 2+ minutes
SELECT cron.schedule(
  'cleanup-stale-online-users',  -- job name
  '* * * * *',                   -- every minute (cron expression)
  $$SELECT public.cleanup_stale_online_users()$$
);
