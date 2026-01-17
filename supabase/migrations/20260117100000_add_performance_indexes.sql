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

-- Index on hidden_shouts for filtering (used in shout queries)
CREATE INDEX IF NOT EXISTS idx_hidden_shouts_user_id
ON hidden_shouts(user_id);

-- GeoIndexes for location-based queries (if not already exist)
-- Using PostGIS GIST indexes for spatial queries
CREATE INDEX IF NOT EXISTS idx_shouts_location
ON shouts USING GIST (ST_SetSRID(ST_MakePoint(lng, lat), 4326));

CREATE INDEX IF NOT EXISTS idx_megaphones_location
ON megaphones USING GIST (ST_SetSRID(ST_MakePoint(lng, lat), 4326));

-- Additional useful indexes for common queries
CREATE INDEX IF NOT EXISTS idx_shouts_user_id
ON shouts(user_id);

CREATE INDEX IF NOT EXISTS idx_shouts_created_at
ON shouts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_megaphones_host_id
ON megaphones(host_id);

CREATE INDEX IF NOT EXISTS idx_megaphones_start_time
ON megaphones(start_time);

CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_id
ON direct_messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_direct_messages_recipient_id
ON direct_messages(recipient_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id
ON notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at
ON notifications(created_at DESC);

-- Composite index for notification_logs lookups
CREATE INDEX IF NOT EXISTS idx_notification_logs_lookup
ON notification_logs(recipient_id, thread_type, thread_id);

-- Index for follows queries
CREATE INDEX IF NOT EXISTS idx_follows_follower_id
ON follows(follower_id);

CREATE INDEX IF NOT EXISTS idx_follows_following_id
ON follows(following_id);

-- Index for event chat messages
CREATE INDEX IF NOT EXISTS idx_event_chat_messages_event_id
ON event_chat_messages(event_id);

CREATE INDEX IF NOT EXISTS idx_event_chat_messages_created_at
ON event_chat_messages(created_at DESC);
