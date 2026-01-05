-- Notification logs for email cooldowns (service-side)
-- Use-case: prevent spamming, e.g. max 1 mail/hour per (recipient, thread)

CREATE TABLE IF NOT EXISTS public.notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  thread_type text NOT NULL,
  thread_id uuid NOT NULL,
  last_sent_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (recipient_id, thread_type, thread_id)
);

-- Keep updated_at fresh
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_notification_logs_updated_at'
  ) THEN
    CREATE TRIGGER update_notification_logs_updated_at
      BEFORE UPDATE ON public.notification_logs
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Lock down from client access; Edge Functions (service role) bypass RLS.
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;


