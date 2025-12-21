-- Ensure a user can't have duplicate participation rows for the same event
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_participants_event_id_user_id_key'
      AND conrelid = 'public.event_participants'::regclass
  ) THEN
    ALTER TABLE public.event_participants
      ADD CONSTRAINT event_participants_event_id_user_id_key UNIQUE (event_id, user_id);
  END IF;
END $$;

-- Fix unread counting to use per-user last_read_at from event_participants
-- (works for both public missions and private 1:1 missions)
CREATE OR REPLACE FUNCTION public.get_unread_message_count(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  unread_count integer := 0;
BEGIN
  SELECT COALESCE(COUNT(ecm.id), 0)
    INTO unread_count
  FROM public.event_chat_messages ecm
  JOIN public.megaphones m
    ON m.id = ecm.event_id
  LEFT JOIN public.event_participants ep
    ON ep.event_id = m.id
   AND ep.user_id = p_user_id
   AND ep.status = 'joined'
  WHERE ecm.user_id <> p_user_id
    AND (m.host_id = p_user_id OR ep.user_id IS NOT NULL)
    AND ecm.created_at > COALESCE(ep.last_read_at, m.created_at, '1970-01-01'::timestamptz);

  RETURN unread_count;
END;
$function$;
