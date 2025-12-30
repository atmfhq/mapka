-- Create table for direct message reactions
CREATE TABLE public.dm_message_reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES public.direct_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT unique_dm_message_user_emoji UNIQUE (message_id, user_id, emoji)
);

-- Enable RLS
ALTER TABLE public.dm_message_reactions ENABLE ROW LEVEL SECURITY;

-- Users can view reactions for messages in their invitations
CREATE POLICY "Users can view dm reactions" 
  ON public.dm_message_reactions 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.direct_messages dm
      WHERE dm.id = dm_message_reactions.message_id
      AND is_invitation_member(dm.invitation_id, auth.uid())
    )
  );

-- Users can add reactions to messages in their invitations
CREATE POLICY "Users can add dm reactions" 
  ON public.dm_message_reactions 
  FOR INSERT 
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.direct_messages dm
      WHERE dm.id = dm_message_reactions.message_id
      AND is_invitation_member(dm.invitation_id, auth.uid())
    )
  );

-- Users can remove their own reactions
CREATE POLICY "Users can remove their own dm reactions" 
  ON public.dm_message_reactions 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_message_reactions;