-- Enable full replica identity for event_participants for realtime updates
ALTER TABLE public.event_participants REPLICA IDENTITY FULL;

-- Add event_participants to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_participants;