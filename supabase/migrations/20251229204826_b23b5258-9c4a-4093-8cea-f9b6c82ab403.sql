-- Enable REPLICA IDENTITY FULL for direct_messages and event_chat_messages
-- This ensures complete row data is available for realtime subscriptions
ALTER TABLE public.direct_messages REPLICA IDENTITY FULL;
ALTER TABLE public.event_chat_messages REPLICA IDENTITY FULL;