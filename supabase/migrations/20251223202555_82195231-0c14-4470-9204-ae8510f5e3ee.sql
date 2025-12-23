-- Add DELETE policy for profiles so users can delete their own profile data
-- This supports GDPR/data privacy rights for users to remove their account data
CREATE POLICY "Users can delete their own profile"
ON public.profiles
FOR DELETE
USING (auth.uid() = id);