-- Add manual location fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN location_lat double precision,
ADD COLUMN location_lng double precision,
ADD COLUMN location_name text;

-- Add validation constraints for coordinates
ALTER TABLE public.profiles
ADD CONSTRAINT profile_location_lat_check CHECK (location_lat IS NULL OR (location_lat >= -90 AND location_lat <= 90)),
ADD CONSTRAINT profile_location_lng_check CHECK (location_lng IS NULL OR (location_lng >= -180 AND location_lng <= 180));