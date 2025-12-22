-- Drop the problematic policies
DROP POLICY IF EXISTS "Authenticated users can view megaphones" ON public.megaphones;
DROP POLICY IF EXISTS "Users can view relevant event participants" ON public.event_participants;

-- Create a security definer function to check megaphone membership without triggering RLS
CREATE OR REPLACE FUNCTION public.check_megaphone_access(megaphone_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.megaphones m
    WHERE m.id = megaphone_id
    AND (
      m.is_private = false
      OR m.host_id = user_id
      OR EXISTS (
        SELECT 1 FROM public.event_participants ep
        WHERE ep.event_id = m.id
        AND ep.user_id = user_id
        AND ep.status = 'joined'
      )
    )
  )
$$;

-- Create a security definer function to check participant visibility without triggering RLS
CREATE OR REPLACE FUNCTION public.check_participant_access(participant_event_id uuid, participant_user_id uuid, requesting_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    participant_user_id = requesting_user_id
    OR EXISTS (
      SELECT 1 FROM public.megaphones m
      WHERE m.id = participant_event_id
      AND m.host_id = requesting_user_id
    )
    OR EXISTS (
      SELECT 1 FROM public.event_participants ep
      WHERE ep.event_id = participant_event_id
      AND ep.user_id = requesting_user_id
      AND ep.status = 'joined'
    )
$$;

-- Create new non-recursive policies for megaphones
CREATE POLICY "Users can view accessible megaphones"
ON public.megaphones
FOR SELECT
TO authenticated
USING (
  is_private = false
  OR host_id = auth.uid()
  OR public.check_megaphone_access(id, auth.uid())
);

-- Create new non-recursive policies for event_participants
CREATE POLICY "Users can view accessible participants"
ON public.event_participants
FOR SELECT
TO authenticated
USING (
  public.check_participant_access(event_id, user_id, auth.uid())
);