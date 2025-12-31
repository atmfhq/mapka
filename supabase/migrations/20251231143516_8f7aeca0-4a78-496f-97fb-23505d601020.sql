-- Add spatial indexes for proximity queries using proper expression syntax

-- Profiles spatial index for get_nearby_profiles
CREATE INDEX IF NOT EXISTS idx_profiles_location_geo 
ON public.profiles 
USING GIST (
  (extensions.ST_SetSRID(extensions.ST_MakePoint(location_lng, location_lat), 4326)::extensions.geography)
)
WHERE location_lat IS NOT NULL AND location_lng IS NOT NULL;

-- Shouts spatial index for get_nearby_shouts
CREATE INDEX IF NOT EXISTS idx_shouts_location_geo 
ON public.shouts 
USING GIST (
  (extensions.ST_SetSRID(extensions.ST_MakePoint(lng, lat), 4326)::extensions.geography)
);

-- Megaphones spatial index for get_nearby_megaphones
CREATE INDEX IF NOT EXISTS idx_megaphones_location_geo 
ON public.megaphones 
USING GIST (
  (extensions.ST_SetSRID(extensions.ST_MakePoint(lng, lat), 4326)::extensions.geography)
);

-- Time-based index for shouts 24hr filter
CREATE INDEX IF NOT EXISTS idx_shouts_created_at ON public.shouts (created_at DESC);