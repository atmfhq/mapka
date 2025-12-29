-- Remove the UNIQUE constraint from nick column to allow duplicate nicknames
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_nick_key;