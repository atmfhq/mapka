-- Add length constraint for title (must be 1-140 characters)
ALTER TABLE public.megaphones 
ADD CONSTRAINT megaphones_title_length 
CHECK (char_length(title) > 0 AND char_length(title) <= 140);

-- Add length constraint for description (max 1000 characters, null allowed)
ALTER TABLE public.megaphones 
ADD CONSTRAINT megaphones_description_length 
CHECK (description IS NULL OR char_length(description) <= 1000);