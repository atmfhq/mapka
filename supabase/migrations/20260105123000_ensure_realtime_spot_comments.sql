-- Ensure spot_comments realtime works in all environments (idempotent)
-- Symptoms when missing: clients subscribe successfully but never receive INSERT/DELETE events for spot_comments.

-- Ensure realtime payloads include full row data (safe even if not strictly required for INSERT)
ALTER TABLE public.spot_comments REPLICA IDENTITY FULL;
ALTER TABLE public.spot_comment_likes REPLICA IDENTITY FULL;

-- Ensure tables are in the supabase_realtime publication (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'spot_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.spot_comments;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'spot_comment_likes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.spot_comment_likes;
  END IF;
END $$;


