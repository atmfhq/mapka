-- Enable realtime for megaphones table
ALTER PUBLICATION supabase_realtime ADD TABLE megaphones;

-- Also enable for profiles to get live user updates
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;