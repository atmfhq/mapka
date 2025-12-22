-- Create a generic text sanitization function
CREATE OR REPLACE FUNCTION public.sanitize_text_input(input_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF input_text IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Strip HTML tags and trim whitespace
  RETURN TRIM(REGEXP_REPLACE(input_text, '<[^>]+>', '', 'g'));
END;
$$;

-- Trigger function for megaphones table
CREATE OR REPLACE FUNCTION public.sanitize_megaphones_input()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.title := public.sanitize_text_input(NEW.title);
  NEW.description := public.sanitize_text_input(NEW.description);
  RETURN NEW;
END;
$$;

-- Trigger function for profiles table
CREATE OR REPLACE FUNCTION public.sanitize_profiles_input()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.nick := public.sanitize_text_input(NEW.nick);
  NEW.bio := public.sanitize_text_input(NEW.bio);
  RETURN NEW;
END;
$$;

-- Trigger function for event_chat_messages table
CREATE OR REPLACE FUNCTION public.sanitize_event_chat_messages_input()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.content := public.sanitize_text_input(NEW.content);
  RETURN NEW;
END;
$$;

-- Trigger function for direct_messages table
CREATE OR REPLACE FUNCTION public.sanitize_direct_messages_input()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.content := public.sanitize_text_input(NEW.content);
  RETURN NEW;
END;
$$;

-- Apply triggers to megaphones
CREATE TRIGGER sanitize_megaphones_before_insert_update
  BEFORE INSERT OR UPDATE ON public.megaphones
  FOR EACH ROW
  EXECUTE FUNCTION public.sanitize_megaphones_input();

-- Apply triggers to profiles
CREATE TRIGGER sanitize_profiles_before_insert_update
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sanitize_profiles_input();

-- Apply triggers to event_chat_messages
CREATE TRIGGER sanitize_event_chat_messages_before_insert_update
  BEFORE INSERT OR UPDATE ON public.event_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.sanitize_event_chat_messages_input();

-- Apply triggers to direct_messages
CREATE TRIGGER sanitize_direct_messages_before_insert_update
  BEFORE INSERT OR UPDATE ON public.direct_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.sanitize_direct_messages_input();