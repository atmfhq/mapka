-- Fix 1: Update profiles RLS policy to require authentication
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Create a new policy that only allows authenticated users to view profiles
CREATE POLICY "Authenticated users can view profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (true);

-- Fix 2: Update megaphones RLS policy to require authentication for public events
-- Drop the existing policy
DROP POLICY IF EXISTS "Public megaphones and private for participants" ON public.megaphones;

-- Create a new policy that requires authentication
-- Authenticated users can see: public megaphones, megaphones they host, or megaphones they participate in
CREATE POLICY "Authenticated users can view megaphones" 
ON public.megaphones 
FOR SELECT 
TO authenticated
USING (
  (is_private = false) 
  OR (host_id = auth.uid()) 
  OR (EXISTS (
    SELECT 1 FROM event_participants
    WHERE event_participants.event_id = megaphones.id 
    AND event_participants.user_id = auth.uid() 
    AND event_participants.status = 'joined'
  ))
);