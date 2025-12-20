-- Drop the buggy SELECT policy
DROP POLICY IF EXISTS "Public megaphones and private for participants" ON public.megaphones;

-- Create corrected SELECT policy with proper join condition
CREATE POLICY "Public megaphones and private for participants"
ON public.megaphones
FOR SELECT
USING (
  -- Public events: visible to everyone
  is_private = false 
  OR 
  -- Private events: only visible to host
  host_id = auth.uid() 
  OR 
  -- Private events: only visible to participants
  EXISTS (
    SELECT 1 FROM public.event_participants 
    WHERE event_participants.event_id = megaphones.id  -- FIXED: was comparing to wrong column
    AND event_participants.user_id = auth.uid()
    AND event_participants.status = 'joined'
  )
);