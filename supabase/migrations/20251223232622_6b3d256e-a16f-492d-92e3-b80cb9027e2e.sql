-- Allow authenticated users to subscribe to profiles realtime channel
-- The filtering of which profiles to show is handled in application code
CREATE POLICY "Authenticated users can subscribe to profiles realtime"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Note: The existing "Public can view map profiles" policy handles 
-- filtering for anonymous users. This new policy allows authenticated
-- users to receive realtime updates for all profile changes.