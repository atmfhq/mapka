-- Add avatar_config JSONB column for modular avatar system (Reddit-style)
-- This will store avatar parts like: { "skinColor": "...", "shape": "...", "eyes": "...", "mouth": "..." }
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS avatar_config JSONB DEFAULT NULL;

-- Add a comment to document the expected structure
COMMENT ON COLUMN public.profiles.avatar_config IS 'Modular avatar configuration: { "skinColor": string, "shape": string, "eyes": string, "mouth": string }';