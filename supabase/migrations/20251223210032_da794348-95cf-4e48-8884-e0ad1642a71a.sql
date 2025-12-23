-- Update check_participant_access to implement bifurcated privacy logic
-- PUBLIC events: Any authenticated user can view participants
-- PRIVATE events: Only host, joined participants, or users with pending invitations

CREATE OR REPLACE FUNCTION public.check_participant_access(participant_event_id uuid, participant_user_id uuid, requesting_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    -- Always allow users to see their own participation
    participant_user_id = requesting_user_id
    OR (
      -- PUBLIC EVENTS: Any authenticated user can view participant list
      EXISTS (
        SELECT 1 FROM public.megaphones m
        WHERE m.id = participant_event_id
        AND m.is_private = false
      )
      AND requesting_user_id IS NOT NULL
    )
    OR (
      -- PRIVATE EVENTS: Restricted access
      EXISTS (
        SELECT 1 FROM public.megaphones m
        WHERE m.id = participant_event_id
        AND m.is_private = true
        AND (
          -- Host can always see participants
          m.host_id = requesting_user_id
          -- Joined participants can see other participants
          OR EXISTS (
            SELECT 1 FROM public.event_participants ep
            WHERE ep.event_id = m.id
            AND ep.user_id = requesting_user_id
            AND ep.status = 'joined'
          )
          -- Users with pending invitation to this event can see participants
          -- (Private events are created from invitations, so check if user has accepted invitation with the host)
          OR EXISTS (
            SELECT 1 FROM public.invitations inv
            WHERE inv.status IN ('pending', 'accepted')
            AND (
              (inv.sender_id = requesting_user_id AND inv.receiver_id = m.host_id)
              OR (inv.receiver_id = requesting_user_id AND inv.sender_id = m.host_id)
            )
          )
        )
      )
    )
$function$;

-- Add a comment documenting the logic for transparency
COMMENT ON FUNCTION public.check_participant_access IS 
'Controls visibility of event participants based on event privacy:
- PUBLIC events: Any authenticated user can view the participant list (social proof)
- PRIVATE events: Only visible to host, joined participants, or users with pending/accepted invitations
- Users can always see their own participation records';