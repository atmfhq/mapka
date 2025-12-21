-- Add server-side validation constraints to megaphones table
ALTER TABLE public.megaphones
ADD CONSTRAINT title_length_check CHECK (char_length(title) >= 3 AND char_length(title) <= 100),
ADD CONSTRAINT lat_bounds_check CHECK (lat >= -90 AND lat <= 90),
ADD CONSTRAINT lng_bounds_check CHECK (lng >= -180 AND lng <= 180),
ADD CONSTRAINT duration_bounds_check CHECK (duration_minutes > 0 AND duration_minutes <= 1440),
ADD CONSTRAINT max_participants_bounds_check CHECK (max_participants >= 2 AND max_participants <= 100);