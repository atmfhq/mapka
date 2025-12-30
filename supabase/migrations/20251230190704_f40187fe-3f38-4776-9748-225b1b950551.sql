-- Create event_likes table
CREATE TABLE public.event_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.megaphones(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_event_user_like UNIQUE (event_id, user_id)
);

-- Enable RLS
ALTER TABLE public.event_likes ENABLE ROW LEVEL SECURITY;

-- Users can view like counts for accessible events
CREATE POLICY "Users can view likes for accessible events"
ON public.event_likes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.megaphones m
    WHERE m.id = event_id
    AND (m.is_private = false OR m.host_id = auth.uid() OR check_megaphone_access(m.id, auth.uid()))
  )
);

-- Users can like events they can access
CREATE POLICY "Users can like accessible events"
ON public.event_likes
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.megaphones m
    WHERE m.id = event_id
    AND (m.is_private = false OR m.host_id = auth.uid() OR check_megaphone_access(m.id, auth.uid()))
  )
);

-- Users can unlike (delete their own likes)
CREATE POLICY "Users can remove their own likes"
ON public.event_likes
FOR DELETE
USING (auth.uid() = user_id);

-- Enable realtime for likes
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_likes;