-- Create event_chat_messages table
CREATE TABLE public.event_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.megaphones(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.event_chat_messages ENABLE ROW LEVEL SECURITY;

-- Create a security definer function to check if user is participant or host
CREATE OR REPLACE FUNCTION public.is_event_member(event_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Check if user is the host
    SELECT 1 FROM public.megaphones WHERE id = event_uuid AND host_id = user_uuid
    UNION
    -- Check if user is a participant
    SELECT 1 FROM public.event_participants WHERE event_id = event_uuid AND user_id = user_uuid AND status = 'joined'
  )
$$;

-- RLS Policies: Only event members can read messages
CREATE POLICY "Event members can view messages"
ON public.event_chat_messages
FOR SELECT
USING (public.is_event_member(event_id, auth.uid()));

-- Only event members can send messages
CREATE POLICY "Event members can send messages"
ON public.event_chat_messages
FOR INSERT
WITH CHECK (public.is_event_member(event_id, auth.uid()) AND auth.uid() = user_id);

-- Enable realtime for chat messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_chat_messages;