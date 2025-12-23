-- Remove the redundant "Users can view only their own profile" policy
-- The "Users can view nearby active profiles" policy already handles self-viewing with "auth.uid() = id"
DROP POLICY IF EXISTS "Users can view only their own profile" ON public.profiles;