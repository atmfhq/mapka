-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Users can create megaphones" ON public.megaphones;

-- Create a more permissive INSERT policy for authenticated users
-- Allow: 1) Normal case where user is host, 2) Private megaphones created on behalf of others
CREATE POLICY "Authenticated users can create megaphones"
ON public.megaphones
FOR INSERT
WITH CHECK (
  -- Either the user is the host
  auth.uid() = host_id
  OR
  -- Or it's a private megaphone (for invitation acceptance flow)
  (is_private = true AND auth.uid() IS NOT NULL)
);