-- Create a table for direct messages between connected users (based on accepted invitations)
CREATE TABLE public.direct_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invitation_id UUID NOT NULL REFERENCES public.invitations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Create index for faster lookups
CREATE INDEX idx_direct_messages_invitation_id ON public.direct_messages(invitation_id);
CREATE INDEX idx_direct_messages_created_at ON public.direct_messages(created_at);

-- Create a security definer function to check if user is part of an invitation
CREATE OR REPLACE FUNCTION public.is_invitation_member(p_invitation_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.invitations
    WHERE id = p_invitation_id
      AND status = 'accepted'
      AND (sender_id = p_user_id OR receiver_id = p_user_id)
  )
$$;

-- Policy: Users can view messages in their accepted invitations
CREATE POLICY "Users can view messages in their invitations"
ON public.direct_messages
FOR SELECT
USING (public.is_invitation_member(invitation_id, auth.uid()));

-- Policy: Users can send messages in their accepted invitations
CREATE POLICY "Users can send messages in their invitations"
ON public.direct_messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id 
  AND public.is_invitation_member(invitation_id, auth.uid())
);

-- Enable realtime for direct_messages table
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;