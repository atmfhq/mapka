-- Update shouts RLS policy to 24 hours
DROP POLICY IF EXISTS "Anyone can view active shouts" ON public.shouts;
CREATE POLICY "Anyone can view active shouts"
ON public.shouts
FOR SELECT
USING (created_at > (now() - interval '24 hours'));

-- Update shout_comments RLS policy to match 24 hour shout lifespan
DROP POLICY IF EXISTS "Anyone can view shout comments" ON public.shout_comments;
CREATE POLICY "Anyone can view shout comments"
ON public.shout_comments
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM shouts s 
  WHERE s.id = shout_comments.shout_id 
  AND s.created_at > (now() - interval '24 hours')
));