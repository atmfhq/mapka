-- Add length validation constraint for chat messages (1-2000 characters)
ALTER TABLE public.event_chat_messages 
ADD CONSTRAINT content_length_check 
CHECK (char_length(content) >= 1 AND char_length(content) <= 2000);