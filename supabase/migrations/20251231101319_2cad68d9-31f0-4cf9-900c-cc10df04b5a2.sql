-- Create shout_likes table for tracking likes on shouts
CREATE TABLE public.shout_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shout_id UUID NOT NULL REFERENCES public.shouts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(shout_id, user_id)
);

-- Enable RLS
ALTER TABLE public.shout_likes ENABLE ROW LEVEL SECURITY;

-- Anyone can view shout likes (shouts are public within 30 min window)
CREATE POLICY "Anyone can view shout likes"
ON public.shout_likes
FOR SELECT
USING (true);

-- Authenticated users can like shouts
CREATE POLICY "Authenticated users can like shouts"
ON public.shout_likes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can remove their own likes
CREATE POLICY "Users can remove their own shout likes"
ON public.shout_likes
FOR DELETE
USING (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.shout_likes;