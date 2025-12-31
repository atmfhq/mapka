-- Add share_code column to megaphones table
ALTER TABLE public.megaphones 
ADD COLUMN share_code text UNIQUE;

-- Create function to generate random 6-character alphanumeric code
CREATE OR REPLACE FUNCTION public.generate_share_code()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  result text := '';
  i integer;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Create function to set share_code on new megaphones
CREATE OR REPLACE FUNCTION public.set_megaphone_share_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_code text;
  code_exists boolean;
BEGIN
  -- Generate unique code
  LOOP
    new_code := public.generate_share_code();
    SELECT EXISTS(SELECT 1 FROM public.megaphones WHERE share_code = new_code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  NEW.share_code := new_code;
  RETURN NEW;
END;
$$;

-- Create trigger to auto-generate share_code on insert
CREATE TRIGGER set_share_code_on_insert
  BEFORE INSERT ON public.megaphones
  FOR EACH ROW
  WHEN (NEW.share_code IS NULL)
  EXECUTE FUNCTION public.set_megaphone_share_code();

-- Backfill existing megaphones with share codes
DO $$
DECLARE
  rec RECORD;
  new_code text;
  code_exists boolean;
BEGIN
  FOR rec IN SELECT id FROM public.megaphones WHERE share_code IS NULL LOOP
    LOOP
      new_code := public.generate_share_code();
      SELECT EXISTS(SELECT 1 FROM public.megaphones WHERE share_code = new_code) INTO code_exists;
      EXIT WHEN NOT code_exists;
    END LOOP;
    UPDATE public.megaphones SET share_code = new_code WHERE id = rec.id;
  END LOOP;
END;
$$;

-- Make share_code NOT NULL after backfill
ALTER TABLE public.megaphones ALTER COLUMN share_code SET NOT NULL;

-- Create index for fast lookups by share_code
CREATE INDEX idx_megaphones_share_code ON public.megaphones(share_code);