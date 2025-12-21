-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Event participants are viewable by everyone" ON public.event_participants;

-- Create a restrictive policy that protects user privacy
CREATE POLICY "Users can view relevant event participants"
ON public.event_participants
FOR SELECT
TO authenticated
USING (
  -- Can see themselves
  auth.uid() = user_id
  OR
  -- Can see participants if user is the event host
  EXISTS (
    SELECT 1 FROM public.megaphones
    WHERE megaphones.id = event_participants.event_id
    AND megaphones.host_id = auth.uid()
  )
  OR
  -- Can see participants if user is also a participant in the same event
  EXISTS (
    SELECT 1 FROM public.event_participants AS my_participation
    WHERE my_participation.event_id = event_participants.event_id
    AND my_participation.user_id = auth.uid()
    AND my_participation.status = 'joined'
  )
);