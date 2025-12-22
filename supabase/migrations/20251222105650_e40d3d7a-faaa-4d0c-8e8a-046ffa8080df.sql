-- Add length validation to direct_messages content column
ALTER TABLE public.direct_messages 
ADD CONSTRAINT direct_messages_content_length_check 
CHECK (char_length(content) >= 1 AND char_length(content) <= 2000);