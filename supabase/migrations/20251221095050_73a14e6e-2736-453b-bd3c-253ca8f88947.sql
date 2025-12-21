-- Add last_read_at column to invitations table
ALTER TABLE public.invitations 
ADD COLUMN last_read_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add last_read_at column to event_participants table
ALTER TABLE public.event_participants 
ADD COLUMN last_read_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create function to get unread message count for a user
CREATE OR REPLACE FUNCTION public.get_unread_message_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  unread_count INTEGER := 0;
  inv_count INTEGER := 0;
  event_count INTEGER := 0;
BEGIN
  -- Count unread messages from private chats (via invitations -> megaphones)
  SELECT COALESCE(SUM(msg_count), 0) INTO inv_count
  FROM (
    SELECT COUNT(ecm.id) as msg_count
    FROM invitations inv
    -- Find the private megaphone created when invitation was accepted
    JOIN megaphones m ON m.is_private = true 
      AND (
        (m.host_id = p_user_id AND EXISTS (
          SELECT 1 FROM event_participants ep 
          WHERE ep.event_id = m.id 
          AND ep.user_id = CASE WHEN inv.sender_id = p_user_id THEN inv.receiver_id ELSE inv.sender_id END
          AND ep.status = 'joined'
        ))
        OR 
        (m.host_id = CASE WHEN inv.sender_id = p_user_id THEN inv.receiver_id ELSE inv.sender_id END
         AND EXISTS (
          SELECT 1 FROM event_participants ep 
          WHERE ep.event_id = m.id 
          AND ep.user_id = p_user_id
          AND ep.status = 'joined'
        ))
      )
    JOIN event_chat_messages ecm ON ecm.event_id = m.id
    WHERE (inv.sender_id = p_user_id OR inv.receiver_id = p_user_id)
      AND inv.status = 'accepted'
      AND ecm.user_id != p_user_id
      AND ecm.created_at > COALESCE(inv.last_read_at, '1970-01-01'::timestamptz)
    GROUP BY inv.id
  ) sub;

  -- Count unread messages from public events the user participates in
  SELECT COALESCE(SUM(msg_count), 0) INTO event_count
  FROM (
    SELECT COUNT(ecm.id) as msg_count
    FROM event_participants ep
    JOIN megaphones m ON m.id = ep.event_id AND m.is_private = false
    JOIN event_chat_messages ecm ON ecm.event_id = ep.event_id
    WHERE ep.user_id = p_user_id
      AND ep.status = 'joined'
      AND ecm.user_id != p_user_id
      AND ecm.created_at > COALESCE(ep.last_read_at, '1970-01-01'::timestamptz)
    GROUP BY ep.id
  ) sub;

  -- Also count for events user is hosting
  SELECT event_count + COALESCE(SUM(msg_count), 0) INTO event_count
  FROM (
    SELECT COUNT(ecm.id) as msg_count
    FROM megaphones m
    JOIN event_chat_messages ecm ON ecm.event_id = m.id
    LEFT JOIN event_participants ep ON ep.event_id = m.id AND ep.user_id = p_user_id
    WHERE m.host_id = p_user_id
      AND m.is_private = false
      AND ecm.user_id != p_user_id
      AND ecm.created_at > COALESCE(ep.last_read_at, m.created_at, '1970-01-01'::timestamptz)
    GROUP BY m.id
  ) sub;

  unread_count := inv_count + event_count;
  
  RETURN unread_count;
END;
$$;