-- Create sanitization trigger function for shout comments FIRST
CREATE OR REPLACE FUNCTION public.sanitize_shout_comments_input()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.content := public.sanitize_text_input(NEW.content);
  RETURN NEW;
END;
$$;

-- Create shout_comments table
CREATE TABLE public.shout_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shout_id UUID NOT NULL REFERENCES public.shouts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.shout_comments ENABLE ROW LEVEL SECURITY;

-- Anyone can view comments on active shouts
CREATE POLICY "Anyone can view shout comments"
ON public.shout_comments
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.shouts s 
  WHERE s.id = shout_id 
  AND s.created_at > now() - interval '30 minutes'
));

-- Authenticated users can comment on shouts
CREATE POLICY "Authenticated users can comment on shouts"
ON public.shout_comments
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete their own shout comments"
ON public.shout_comments
FOR DELETE
USING (auth.uid() = user_id);

-- Add sanitization trigger for comment content
CREATE TRIGGER sanitize_shout_comments_before_insert
BEFORE INSERT ON public.shout_comments
FOR EACH ROW
EXECUTE FUNCTION public.sanitize_shout_comments_input();

-- Create shout_comment_likes table for liking comments
CREATE TABLE public.shout_comment_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id UUID NOT NULL REFERENCES public.shout_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE public.shout_comment_likes ENABLE ROW LEVEL SECURITY;

-- Anyone can view comment likes
CREATE POLICY "Anyone can view shout comment likes"
ON public.shout_comment_likes
FOR SELECT
USING (true);

-- Authenticated users can like comments
CREATE POLICY "Authenticated users can like shout comments"
ON public.shout_comment_likes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can remove their own comment likes
CREATE POLICY "Users can remove their own shout comment likes"
ON public.shout_comment_likes
FOR DELETE
USING (auth.uid() = user_id);

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.shout_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shout_comment_likes;