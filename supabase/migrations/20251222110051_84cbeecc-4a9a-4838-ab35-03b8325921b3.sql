-- Add DELETE policy for event_chat_messages so users can delete their own messages
CREATE POLICY "Users can delete their own messages"
ON public.event_chat_messages
FOR DELETE
USING (auth.uid() = user_id);