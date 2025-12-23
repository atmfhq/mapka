-- Enable REPLICA IDENTITY FULL for complete row data on updates
ALTER TABLE public.profiles REPLICA IDENTITY FULL;