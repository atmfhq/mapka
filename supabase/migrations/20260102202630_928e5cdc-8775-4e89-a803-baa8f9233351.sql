-- Create notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL,
  trigger_user_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('friend_event', 'friend_shout', 'new_participant', 'new_comment')),
  resource_id uuid NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for fast lookups
CREATE INDEX idx_notifications_recipient ON public.notifications(recipient_id);
CREATE INDEX idx_notifications_recipient_unread ON public.notifications(recipient_id) WHERE is_read = false;
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = recipient_id);

CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = recipient_id);

CREATE POLICY "Users can delete their own notifications"
ON public.notifications FOR DELETE
USING (auth.uid() = recipient_id);

-- System can insert notifications (via triggers with SECURITY DEFINER)
CREATE POLICY "System can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);

-- Enable realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ================================================
-- TRIGGER 1: Friend Created Event (megaphones)
-- When a user creates a public event, notify all followers
-- ================================================
CREATE OR REPLACE FUNCTION public.notify_followers_on_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only for public events
  IF NEW.is_private = true THEN
    RETURN NEW;
  END IF;
  
  -- Insert notification for each follower
  INSERT INTO public.notifications (recipient_id, trigger_user_id, type, resource_id)
  SELECT 
    f.follower_id,
    NEW.host_id,
    'friend_event',
    NEW.id
  FROM public.follows f
  WHERE f.following_id = NEW.host_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_event_created_notify_followers
AFTER INSERT ON public.megaphones
FOR EACH ROW
EXECUTE FUNCTION public.notify_followers_on_event();

-- ================================================
-- TRIGGER 2: Friend Created Shout
-- When a user creates a shout, notify all followers
-- ================================================
CREATE OR REPLACE FUNCTION public.notify_followers_on_shout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (recipient_id, trigger_user_id, type, resource_id)
  SELECT 
    f.follower_id,
    NEW.user_id,
    'friend_shout',
    NEW.id
  FROM public.follows f
  WHERE f.following_id = NEW.user_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_shout_created_notify_followers
AFTER INSERT ON public.shouts
FOR EACH ROW
EXECUTE FUNCTION public.notify_followers_on_shout();

-- ================================================
-- TRIGGER 3: Participant Joined Event
-- When someone joins an event, notify the host
-- ================================================
CREATE OR REPLACE FUNCTION public.notify_host_on_participant_join()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host_id uuid;
BEGIN
  -- Only for 'joined' status
  IF NEW.status != 'joined' THEN
    RETURN NEW;
  END IF;
  
  -- Get the host of the event
  SELECT host_id INTO v_host_id
  FROM public.megaphones
  WHERE id = NEW.event_id;
  
  -- Don't notify if user is joining their own event
  IF v_host_id IS NULL OR v_host_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  
  -- Insert notification for host
  INSERT INTO public.notifications (recipient_id, trigger_user_id, type, resource_id)
  VALUES (v_host_id, NEW.user_id, 'new_participant', NEW.event_id);
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_participant_joined_notify_host
AFTER INSERT ON public.event_participants
FOR EACH ROW
EXECUTE FUNCTION public.notify_host_on_participant_join();

-- ================================================
-- TRIGGER 4a: Comment on Shout -> Notify Shout Author
-- ================================================
CREATE OR REPLACE FUNCTION public.notify_author_on_shout_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author_id uuid;
BEGIN
  -- Get the shout author
  SELECT user_id INTO v_author_id
  FROM public.shouts
  WHERE id = NEW.shout_id;
  
  -- Don't notify if user is commenting on their own shout
  IF v_author_id IS NULL OR v_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  
  -- Insert notification for shout author
  INSERT INTO public.notifications (recipient_id, trigger_user_id, type, resource_id)
  VALUES (v_author_id, NEW.user_id, 'new_comment', NEW.shout_id);
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_shout_comment_notify_author
AFTER INSERT ON public.shout_comments
FOR EACH ROW
EXECUTE FUNCTION public.notify_author_on_shout_comment();

-- ================================================
-- TRIGGER 4b: Comment on Spot -> Notify Spot Host
-- ================================================
CREATE OR REPLACE FUNCTION public.notify_host_on_spot_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host_id uuid;
BEGIN
  -- Get the spot host
  SELECT host_id INTO v_host_id
  FROM public.megaphones
  WHERE id = NEW.spot_id;
  
  -- Don't notify if user is commenting on their own spot
  IF v_host_id IS NULL OR v_host_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  
  -- Insert notification for spot host
  INSERT INTO public.notifications (recipient_id, trigger_user_id, type, resource_id)
  VALUES (v_host_id, NEW.user_id, 'new_comment', NEW.spot_id);
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_spot_comment_notify_host
AFTER INSERT ON public.spot_comments
FOR EACH ROW
EXECUTE FUNCTION public.notify_host_on_spot_comment();