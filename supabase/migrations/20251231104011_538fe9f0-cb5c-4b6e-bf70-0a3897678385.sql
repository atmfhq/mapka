-- Create spot_comments table (mirrors shout_comments)
CREATE TABLE public.spot_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  spot_id UUID NOT NULL REFERENCES public.megaphones(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.spot_comments ENABLE ROW LEVEL SECURITY;

-- RLS policies for spot_comments
CREATE POLICY "Anyone can view spot comments for accessible spots"
ON public.spot_comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.megaphones m
    WHERE m.id = spot_comments.spot_id
    AND (
      m.is_private = false
      OR m.host_id = auth.uid()
      OR check_megaphone_access(m.id, auth.uid())
    )
  )
);

CREATE POLICY "Authenticated users can comment on accessible spots"
ON public.spot_comments
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.megaphones m
    WHERE m.id = spot_comments.spot_id
    AND (
      m.is_private = false
      OR m.host_id = auth.uid()
      OR check_megaphone_access(m.id, auth.uid())
    )
  )
);

CREATE POLICY "Users can delete their own spot comments"
ON public.spot_comments
FOR DELETE
USING (auth.uid() = user_id);

-- Create spot_comment_likes table (mirrors shout_comment_likes)
CREATE TABLE public.spot_comment_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id UUID NOT NULL REFERENCES public.spot_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

-- Enable RLS
ALTER TABLE public.spot_comment_likes ENABLE ROW LEVEL SECURITY;

-- RLS policies for spot_comment_likes
CREATE POLICY "Anyone can view spot comment likes"
ON public.spot_comment_likes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.spot_comments sc
    JOIN public.megaphones m ON m.id = sc.spot_id
    WHERE sc.id = spot_comment_likes.comment_id
    AND (
      m.is_private = false
      OR m.host_id = auth.uid()
      OR check_megaphone_access(m.id, auth.uid())
    )
  )
);

CREATE POLICY "Authenticated users can like spot comments"
ON public.spot_comment_likes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own spot comment likes"
ON public.spot_comment_likes
FOR DELETE
USING (auth.uid() = user_id);

-- Create sanitize trigger for spot comments
CREATE OR REPLACE FUNCTION public.sanitize_spot_comments_input()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.content := public.sanitize_text_input(NEW.content);
  RETURN NEW;
END;
$$;

CREATE TRIGGER sanitize_spot_comments_before_insert
BEFORE INSERT ON public.spot_comments
FOR EACH ROW
EXECUTE FUNCTION public.sanitize_spot_comments_input();

-- Enable realtime for spot_comments
ALTER PUBLICATION supabase_realtime ADD TABLE public.spot_comments;