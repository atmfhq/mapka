-- Create a security definer function to delete user account
-- This function runs with elevated privileges to delete from auth.users

CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  -- Get the current user's ID
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Delete from auth.users - this will cascade to profiles due to the existing foreign key
  -- First we need to clean up tables that might not have cascade set up
  DELETE FROM public.event_chat_messages WHERE user_id = current_user_id;
  DELETE FROM public.event_participants WHERE user_id = current_user_id;
  DELETE FROM public.invitations WHERE sender_id = current_user_id OR receiver_id = current_user_id;
  DELETE FROM public.megaphones WHERE host_id = current_user_id;
  DELETE FROM public.profiles WHERE id = current_user_id;
  
  -- Finally delete the auth user - this requires service_role privileges
  -- which SECURITY DEFINER provides when the function owner has those rights
  DELETE FROM auth.users WHERE id = current_user_id;
END;
$$;