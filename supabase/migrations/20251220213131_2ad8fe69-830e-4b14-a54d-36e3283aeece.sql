-- Tighten megaphones INSERT policy to prevent spoofing host_id.
-- Private-mission creation on behalf of another user should happen via backend function.
DROP POLICY IF EXISTS "Authenticated users can create megaphones" ON public.megaphones;

CREATE POLICY "Users can create their own megaphones"
ON public.megaphones
FOR INSERT
TO authenticated
WITH CHECK (
  (select auth.uid()) = host_id
);

-- Ensure is_private has a default (already added), but keep this idempotent.
ALTER TABLE public.megaphones
ALTER COLUMN is_private SET DEFAULT false;