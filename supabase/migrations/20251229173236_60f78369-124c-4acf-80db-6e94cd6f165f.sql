-- Create muted_chats table to track which chats users have muted
CREATE TABLE public.muted_chats (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  event_id uuid REFERENCES public.megaphones(id) ON DELETE CASCADE,
  invitation_id uuid REFERENCES public.invitations(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT muted_chats_unique UNIQUE (user_id, event_id, invitation_id),
  CONSTRAINT muted_chats_one_target CHECK (
    (event_id IS NOT NULL AND invitation_id IS NULL) OR
    (event_id IS NULL AND invitation_id IS NOT NULL)
  )
);

-- Enable RLS
ALTER TABLE public.muted_chats ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own muted chats"
ON public.muted_chats
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can mute chats"
ON public.muted_chats
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unmute chats"
ON public.muted_chats
FOR DELETE
USING (auth.uid() = user_id);