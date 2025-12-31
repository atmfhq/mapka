-- Create hidden_shouts table for personal dismissal
CREATE TABLE public.hidden_shouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  shout_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT hidden_shouts_unique_pair UNIQUE (user_id, shout_id)
);

-- Enable Row Level Security
ALTER TABLE public.hidden_shouts ENABLE ROW LEVEL SECURITY;

-- Users can only view their own hidden shouts
CREATE POLICY "Users can view their own hidden shouts"
ON public.hidden_shouts
FOR SELECT
USING (auth.uid() = user_id);

-- Users can hide shouts (insert)
CREATE POLICY "Users can hide shouts"
ON public.hidden_shouts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can unhide shouts (delete their own records)
CREATE POLICY "Users can unhide shouts"
ON public.hidden_shouts
FOR DELETE
USING (auth.uid() = user_id);