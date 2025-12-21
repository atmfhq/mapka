-- First, create a function to check if a user can message in a private megaphone
-- This checks if the invitation is still accepted
CREATE OR REPLACE FUNCTION public.can_message_in_event(p_event_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- For public megaphones: check if user is host or participant
    SELECT 1 FROM public.megaphones m
    WHERE m.id = p_event_id 
      AND m.is_private = false
      AND (
        m.host_id = p_user_id 
        OR EXISTS (
          SELECT 1 FROM public.event_participants ep 
          WHERE ep.event_id = m.id AND ep.user_id = p_user_id AND ep.status = 'joined'
        )
      )
    UNION ALL
    -- For private megaphones: check that invitation between participants is still accepted
    SELECT 1 FROM public.megaphones m
    WHERE m.id = p_event_id 
      AND m.is_private = true
      AND (
        m.host_id = p_user_id 
        OR EXISTS (
          SELECT 1 FROM public.event_participants ep 
          WHERE ep.event_id = m.id AND ep.user_id = p_user_id AND ep.status = 'joined'
        )
      )
      -- Check the underlying invitation is still accepted
      AND EXISTS (
        SELECT 1 FROM public.invitations inv
        WHERE inv.status = 'accepted'
          AND (
            -- User is sender and host is receiver, or vice versa
            (inv.sender_id = p_user_id AND inv.receiver_id = m.host_id)
            OR (inv.receiver_id = p_user_id AND inv.sender_id = m.host_id)
            -- Or check against other participant
            OR EXISTS (
              SELECT 1 FROM public.event_participants ep2
              WHERE ep2.event_id = m.id 
                AND ep2.user_id != p_user_id
                AND ep2.status = 'joined'
                AND (
                  (inv.sender_id = p_user_id AND inv.receiver_id = ep2.user_id)
                  OR (inv.receiver_id = p_user_id AND inv.sender_id = ep2.user_id)
                )
            )
          )
      )
  )
$$;

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Event members can send messages" ON public.event_chat_messages;

-- Create new INSERT policy that checks invitation status for private megaphones
CREATE POLICY "Event members can send messages" 
ON public.event_chat_messages 
FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  AND can_message_in_event(event_id, auth.uid())
);

-- Also allow users to delete invitations (for full disconnect)
DROP POLICY IF EXISTS "Users can cancel their invitations" ON public.invitations;
CREATE POLICY "Users can cancel their invitations" 
ON public.invitations 
FOR UPDATE
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);