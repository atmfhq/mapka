-- Performance indexes migration
-- Adds missing indexes on frequently queried columns

-- Indexes on comments tables (critical for comment loading performance)
CREATE INDEX IF NOT EXISTS idx_shout_comments_shout_id
ON shout_comments(shout_id);

CREATE INDEX IF NOT EXISTS idx_spot_comments_spot_id
ON spot_comments(spot_id);

-- Indexes on event participants (for participant queries)
CREATE INDEX IF NOT EXISTS idx_event_participants_event_id
ON event_participants(event_id);

CREATE INDEX IF NOT EXISTS idx_event_participants_user_id
ON event_participants(user_id);

-- Index on hidden_shouts for filtering
CREATE INDEX IF NOT EXISTS idx_hidden_shouts_user_id
ON hidden_shouts(user_id);

-- Simple lat/lng indexes for location queries
CREATE INDEX IF NOT EXISTS idx_shouts_lat ON shouts(lat);
CREATE INDEX IF NOT EXISTS idx_shouts_lng ON shouts(lng);
CREATE INDEX IF NOT EXISTS idx_megaphones_lat ON megaphones(lat);
CREATE INDEX IF NOT EXISTS idx_megaphones_lng ON megaphones(lng);

-- Indexes on shouts
CREATE INDEX IF NOT EXISTS idx_shouts_user_id ON shouts(user_id);

-- Indexes on megaphones
CREATE INDEX IF NOT EXISTS idx_megaphones_host_id ON megaphones(host_id);
CREATE INDEX IF NOT EXISTS idx_megaphones_start_time ON megaphones(start_time);

-- Composite index for notification_logs lookups
CREATE INDEX IF NOT EXISTS idx_notification_logs_lookup
ON notification_logs(recipient_id, thread_type, thread_id);

-- Index for follows queries
CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows(following_id);

-- Index for event chat messages
CREATE INDEX IF NOT EXISTS idx_event_chat_messages_event_id ON event_chat_messages(event_id);
