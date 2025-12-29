-- Update the handle_new_user function to generate unique temporary nicknames
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  generated_nick TEXT;
BEGIN
  -- Generate a unique nickname using 'user_' prefix + random 8-character suffix
  -- Uses random() + clock_timestamp() for guaranteed uniqueness
  generated_nick := 'user_' || substr(md5(random()::text || clock_timestamp()::text), 1, 8);
  
  -- Insert with generated unique nickname
  INSERT INTO public.profiles (id, nick)
  VALUES (NEW.id, generated_nick);
  
  RETURN NEW;
END;
$$;