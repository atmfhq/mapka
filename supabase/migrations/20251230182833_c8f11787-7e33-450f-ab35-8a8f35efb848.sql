-- Create connections table for user relationships
CREATE TABLE public.connections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_a_id uuid NOT NULL,
  user_b_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Ensure user_a_id is always the smaller UUID to prevent duplicate pairs
  CONSTRAINT connections_user_order CHECK (user_a_id < user_b_id),
  CONSTRAINT connections_unique_pair UNIQUE (user_a_id, user_b_id)
);

-- Enable RLS
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

-- Users can view their own connections
CREATE POLICY "Users can view their connections"
ON public.connections
FOR SELECT
USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

-- System creates connections via trigger (no direct insert by users)
-- We'll use SECURITY DEFINER function for the trigger

-- Function to create connection when user joins an event
CREATE OR REPLACE FUNCTION public.create_connection_on_event_join()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_host_id uuid;
  v_user_a uuid;
  v_user_b uuid;
BEGIN
  -- Only process 'joined' status
  IF NEW.status != 'joined' THEN
    RETURN NEW;
  END IF;
  
  -- Get the host of the event
  SELECT host_id INTO v_host_id
  FROM public.megaphones
  WHERE id = NEW.event_id;
  
  -- Don't create connection if user is the host
  IF v_host_id IS NULL OR v_host_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  
  -- Order the UUIDs so user_a < user_b (required by constraint)
  IF NEW.user_id < v_host_id THEN
    v_user_a := NEW.user_id;
    v_user_b := v_host_id;
  ELSE
    v_user_a := v_host_id;
    v_user_b := NEW.user_id;
  END IF;
  
  -- Insert connection if it doesn't exist (ON CONFLICT DO NOTHING)
  INSERT INTO public.connections (user_a_id, user_b_id)
  VALUES (v_user_a, v_user_b)
  ON CONFLICT (user_a_id, user_b_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create trigger on event_participants
CREATE TRIGGER on_event_join_create_connection
AFTER INSERT ON public.event_participants
FOR EACH ROW
EXECUTE FUNCTION public.create_connection_on_event_join();

-- Enable realtime for connections table
ALTER PUBLICATION supabase_realtime ADD TABLE public.connections;