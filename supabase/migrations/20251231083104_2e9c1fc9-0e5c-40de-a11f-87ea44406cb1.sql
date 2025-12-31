-- Add is_chat_banned column to event_participants
ALTER TABLE public.event_participants 
ADD COLUMN is_chat_banned boolean NOT NULL DEFAULT false;

-- Update the can_message_in_event function to check for chat ban
CREATE OR REPLACE FUNCTION public.can_message_in_event(p_event_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    -- For public megaphones: check if user is host or participant (and not chat banned)
    SELECT 1 FROM public.megaphones m
    WHERE m.id = p_event_id 
      AND m.is_private = false
      AND (
        m.host_id = p_user_id 
        OR EXISTS (
          SELECT 1 FROM public.event_participants ep 
          WHERE ep.event_id = m.id 
            AND ep.user_id = p_user_id 
            AND ep.status = 'joined'
            AND ep.chat_active = true
            AND ep.is_chat_banned = false
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
          WHERE ep.event_id = m.id 
            AND ep.user_id = p_user_id 
            AND ep.status = 'joined'
            AND ep.chat_active = true
            AND ep.is_chat_banned = false
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
$function$;

-- Create function to check if user is chat banned from an event
CREATE OR REPLACE FUNCTION public.is_chat_banned_from_event(p_event_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.event_participants
    WHERE event_id = p_event_id 
      AND user_id = p_user_id 
      AND is_chat_banned = true
  )
$function$;

-- Allow hosts to update is_chat_banned for participants in their events
CREATE POLICY "Hosts can update chat ban status"
ON public.event_participants
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.megaphones m
    WHERE m.id = event_participants.event_id
      AND m.host_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.megaphones m
    WHERE m.id = event_participants.event_id
      AND m.host_id = auth.uid()
  )
);