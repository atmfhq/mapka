-- Add is_active column to profiles table for Ghost Mode
ALTER TABLE public.profiles 
ADD COLUMN is_active boolean NOT NULL DEFAULT true;