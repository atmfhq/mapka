-- Create invitations table
CREATE TABLE public.invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add is_private column to megaphones
ALTER TABLE public.megaphones 
ADD COLUMN is_private BOOLEAN NOT NULL DEFAULT false;

-- Enable RLS on invitations
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Invitations RLS: Users can see invites they sent or received
CREATE POLICY "Users can view their own invitations"
ON public.invitations
FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Users can create invitations as sender
CREATE POLICY "Users can send invitations"
ON public.invitations
FOR INSERT
WITH CHECK (auth.uid() = sender_id);

-- Users can update invitations they received (to accept/reject)
CREATE POLICY "Receivers can update invitation status"
ON public.invitations
FOR UPDATE
USING (auth.uid() = receiver_id);

-- Update megaphones RLS for private events
-- Drop existing select policy and recreate with private event logic
DROP POLICY IF EXISTS "Megaphones are viewable by everyone" ON public.megaphones;

-- Create function to check if user is participant or host
CREATE OR REPLACE FUNCTION public.can_view_megaphone(megaphone_row public.megaphones)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE 
      WHEN megaphone_row.is_private = false THEN true
      WHEN megaphone_row.host_id = auth.uid() THEN true
      WHEN EXISTS (
        SELECT 1 FROM public.event_participants 
        WHERE event_id = megaphone_row.id 
        AND user_id = auth.uid()
        AND status = 'joined'
      ) THEN true
      ELSE false
    END
$$;

-- New megaphones select policy with private event support
CREATE POLICY "Public megaphones and private for participants"
ON public.megaphones
FOR SELECT
USING (
  is_private = false 
  OR host_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM public.event_participants 
    WHERE event_id = id 
    AND user_id = auth.uid()
    AND status = 'joined'
  )
);

-- Enable realtime for invitations
ALTER PUBLICATION supabase_realtime ADD TABLE public.invitations;