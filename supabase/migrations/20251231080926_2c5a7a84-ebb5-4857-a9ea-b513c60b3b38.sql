-- Create spot_bans table for local event moderation
CREATE TABLE public.spot_bans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.megaphones(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  banned_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- Enable RLS
ALTER TABLE public.spot_bans ENABLE ROW LEVEL SECURITY;

-- Only host can view bans for their events
CREATE POLICY "Hosts can view bans for their events"
ON public.spot_bans
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.megaphones m
    WHERE m.id = event_id AND m.host_id = auth.uid()
  )
);

-- Only host can ban users from their events
CREATE POLICY "Hosts can ban users from their events"
ON public.spot_bans
FOR INSERT
WITH CHECK (
  auth.uid() = banned_by
  AND EXISTS (
    SELECT 1 FROM public.megaphones m
    WHERE m.id = event_id AND m.host_id = auth.uid()
  )
);

-- Only host can unban users from their events
CREATE POLICY "Hosts can unban users from their events"
ON public.spot_bans
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.megaphones m
    WHERE m.id = event_id AND m.host_id = auth.uid()
  )
);

-- Create function to check if user is banned from event
CREATE OR REPLACE FUNCTION public.is_banned_from_event(p_event_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.spot_bans
    WHERE event_id = p_event_id AND user_id = p_user_id
  )
$$;

-- Enable realtime for spot_bans
ALTER PUBLICATION supabase_realtime ADD TABLE public.spot_bans;