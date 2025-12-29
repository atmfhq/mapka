-- Add chat_active column to track if user has left the chat while still being a participant
ALTER TABLE public.event_participants 
ADD COLUMN chat_active boolean NOT NULL DEFAULT true;

-- Add comment explaining the column
COMMENT ON COLUMN public.event_participants.chat_active IS 'Whether the user is active in the spot chat. False means they left the chat but are still attending the event.';