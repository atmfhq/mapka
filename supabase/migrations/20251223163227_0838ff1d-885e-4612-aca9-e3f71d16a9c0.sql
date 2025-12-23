-- Add last_bounce_at column to profiles table for bounce interaction
ALTER TABLE public.profiles 
ADD COLUMN last_bounce_at timestamp with time zone DEFAULT NULL;