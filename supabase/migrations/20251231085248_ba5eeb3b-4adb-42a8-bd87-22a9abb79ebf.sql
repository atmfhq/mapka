-- Update the SELECT policy for event_chat_messages to also check for chat bans
-- Drop the existing policy first
DROP POLICY IF EXISTS "Event members can view messages" ON public.event_chat_messages;

-- Create new policy that blocks read access for chat-banned users
CREATE POLICY "Event members can view messages" 
ON public.event_chat_messages 
FOR SELECT 
USING (
  is_event_member(event_id, auth.uid()) 
  AND NOT is_chat_banned_from_event(event_id, auth.uid())
);