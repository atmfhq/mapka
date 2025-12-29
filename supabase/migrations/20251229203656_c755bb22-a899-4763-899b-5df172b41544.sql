-- Simplify accept_invitation: just update status, don't create private megaphones
-- Direct connections between users should be simple DM relationships, not hidden events

CREATE OR REPLACE FUNCTION public.accept_invitation(p_invitation_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invitation record;
  v_current_user uuid;
BEGIN
  -- Rate limit: 10 calls per 60 seconds
  PERFORM public.check_rate_limit('accept_invitation', 10, 60);
  
  v_current_user := auth.uid();
  
  -- Verify the invitation exists and belongs to current user as receiver
  SELECT * INTO v_invitation
  FROM public.invitations
  WHERE id = p_invitation_id
    AND receiver_id = v_current_user
    AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or already processed invitation';
  END IF;
  
  -- Simply update invitation status to 'accepted'
  -- No need to create a private megaphone - the invitation itself represents the connection
  UPDATE public.invitations
  SET status = 'accepted'
  WHERE id = p_invitation_id;
  
  -- The direct_messages table uses invitation_id as the link between users
  -- so they can start chatting immediately after this update
END;
$function$;

-- Set default for activity_type to 'connection' for simpler invite flow
ALTER TABLE public.invitations 
ALTER COLUMN activity_type SET DEFAULT 'connection';