-- Ensure realtime payloads include full row data
ALTER TABLE public.direct_messages REPLICA IDENTITY FULL;
ALTER TABLE public.event_chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.invitations REPLICA IDENTITY FULL;

-- Ensure tables are in the supabase_realtime publication (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'direct_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'event_chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_chat_messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'invitations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.invitations;
  END IF;
END $$;