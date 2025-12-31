-- Create shouts table for temporary map notices
CREATE TABLE public.shouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.shouts ENABLE ROW LEVEL SECURITY;

-- Anyone can view shouts that are less than 30 minutes old
CREATE POLICY "Anyone can view active shouts"
ON public.shouts
FOR SELECT
USING (created_at > now() - interval '30 minutes');

-- Authenticated users can create shouts
CREATE POLICY "Authenticated users can create shouts"
ON public.shouts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own shouts
CREATE POLICY "Users can delete their own shouts"
ON public.shouts
FOR DELETE
USING (auth.uid() = user_id);

-- Add sanitization trigger for content
CREATE OR REPLACE FUNCTION public.sanitize_shouts_input()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.content := public.sanitize_text_input(NEW.content);
  RETURN NEW;
END;
$$;

CREATE TRIGGER sanitize_shouts_before_insert
BEFORE INSERT ON public.shouts
FOR EACH ROW
EXECUTE FUNCTION public.sanitize_shouts_input();

-- Enable realtime for shouts
ALTER PUBLICATION supabase_realtime ADD TABLE public.shouts;