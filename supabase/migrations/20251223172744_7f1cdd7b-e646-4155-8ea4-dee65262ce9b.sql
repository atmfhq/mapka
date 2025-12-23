-- Enable full replica identity for megaphones to capture complete row data on updates
ALTER TABLE public.megaphones REPLICA IDENTITY FULL;