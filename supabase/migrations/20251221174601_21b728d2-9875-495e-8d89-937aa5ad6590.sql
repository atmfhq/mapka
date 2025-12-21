-- Enable REPLICA IDENTITY FULL for proper realtime filtering with old values
ALTER TABLE public.invitations REPLICA IDENTITY FULL;