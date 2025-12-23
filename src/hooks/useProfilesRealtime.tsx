import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Broadcast payload for live position updates.
 * Contains ALL data needed to render the avatar - NO RPC refetch required.
 */
export interface ProfileBroadcastPayload {
  user_id: string;
  event_type: 'location_update' | 'bounce' | 'status_change';
  lat: number;
  lng: number;
  timestamp: string;
  // Full avatar data for immediate rendering (no RPC needed)
  nick?: string | null;
  avatar_config?: any;
  avatar_url?: string | null;
  tags?: string[] | null;
  bio?: string | null;
  is_active?: boolean;
  last_bounce_at?: string | null;
}

export interface ProfileData {
  id: string;
  nick: string | null;
  location_lat: number | null;
  location_lng: number | null;
  last_bounce_at?: string | null;
  is_active: boolean;
  avatar_config: any;
  avatar_url?: string | null;
  tags: string[] | null;
  bio: string | null;
}

interface UseProfilesRealtimeOptions {
  /** Current user's ID */
  currentUserId?: string | null;
  /** Current user's lat/lng (used for channel scoping) */
  userLat?: number;
  userLng?: number;
  /**
   * Discovery radius used by the map (meters).
   * We subscribe to all grid cells that intersect this radius so passive updates work
   * even when the current user is idle.
   */
  radiusMeters?: number;
  /** Called with the updated profile data for surgical marker updates */
  onProfileUpdate?: (profile: ProfileData) => void;
  /** Called when a bounce is detected */
  onBounceUpdate?: (userId: string, bounceAt: string) => void;
  enabled?: boolean;
}

// Round to 2 decimal places for channel scoping (~1km grid cells)
const getChannelKey = (lat: number, lng: number): string => {
  const roundedLat = Math.round(lat * 100) / 100;
  const roundedLng = Math.round(lng * 100) / 100;
  return `map-presence-${roundedLat}-${roundedLng}`;
};

const GRID_STEP_DEG = 0.01; // matches getChannelKey 2dp rounding
const METERS_PER_DEG_LAT = 111_320;

// Get surrounding channel keys for passive coverage within a radius
const getAdjacentChannelKeys = (lat: number, lng: number, radiusMeters?: number): string[] => {
  const roundedLat = Math.round(lat * 100) / 100;
  const roundedLng = Math.round(lng * 100) / 100;

  // Backwards-compatible default: 3x3 grid around current cell
  const stepsLat =
    radiusMeters === undefined
      ? 1
      : Math.max(1, Math.ceil(radiusMeters / (METERS_PER_DEG_LAT * GRID_STEP_DEG)));

  // Longitude degrees shrink by latitude; compensate so east/west coverage matches radius.
  const metersPerDegLng = METERS_PER_DEG_LAT * Math.cos((roundedLat * Math.PI) / 180);
  const stepsLng =
    radiusMeters === undefined
      ? 1
      : Math.max(1, Math.ceil(radiusMeters / (Math.max(1, metersPerDegLng) * GRID_STEP_DEG)));

  console.log('[Broadcast] Channel coverage:', { radiusMeters, stepsLat, stepsLng });

  const channels: string[] = [];

  for (let dLat = -stepsLat * GRID_STEP_DEG; dLat <= stepsLat * GRID_STEP_DEG; dLat += GRID_STEP_DEG) {
    for (let dLng = -stepsLng * GRID_STEP_DEG; dLng <= stepsLng * GRID_STEP_DEG; dLng += GRID_STEP_DEG) {
      const cellLat = Math.round((roundedLat + dLat) * 100) / 100;
      const cellLng = Math.round((roundedLng + dLng) * 100) / 100;
      channels.push(`map-presence-${cellLat}-${cellLng}`);
    }
  }

  return [...new Set(channels)];
};

export const useProfilesRealtime = ({
  currentUserId,
  userLat,
  userLng,
  radiusMeters,
  onProfileUpdate,
  onBounceUpdate,
  enabled = true
}: UseProfilesRealtimeOptions) => {
  const lastBounceTimestamps = useRef<Map<string, string>>(new Map());
  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([]);

  // Handle incoming broadcast message - USE PAYLOAD DIRECTLY, NO RPC FETCH
  const handleBroadcast = useCallback((payload: { payload: ProfileBroadcastPayload }) => {
    const { 
      user_id, 
      event_type, 
      lat, 
      lng, 
      timestamp,
      nick,
      avatar_config,
      avatar_url,
      tags,
      bio,
      is_active,
      last_bounce_at
    } = payload.payload;

    // Skip our own broadcasts (only if logged in)
    if (currentUserId && user_id === currentUserId) {
      console.log('[Broadcast] Ignoring own broadcast');
      return;
    }

    console.log('[Broadcast] Received:', { user_id, event_type, lat, lng });

    if (event_type === 'location_update' && onProfileUpdate) {
      // DIRECT UPDATE from broadcast payload - NO RPC CALL
      const profile: ProfileData = {
        id: user_id,
        nick: nick ?? null,
        location_lat: lat,
        location_lng: lng,
        avatar_config: avatar_config ?? null,
        avatar_url: avatar_url ?? null,
        tags: tags ?? null,
        bio: bio ?? null,
        is_active: is_active ?? true,
        last_bounce_at: last_bounce_at ?? null
      };
      console.log('[Broadcast] ✓ Direct profile update from payload:', profile.id);
      onProfileUpdate(profile);
    }

    if (event_type === 'bounce' && onBounceUpdate) {
      const lastKnownBounce = lastBounceTimestamps.current.get(user_id);
      if (timestamp !== lastKnownBounce) {
        lastBounceTimestamps.current.set(user_id, timestamp);
        onBounceUpdate(user_id, timestamp);
      }
    }

    if (event_type === 'status_change' && onProfileUpdate) {
      const profile: ProfileData = {
        id: user_id,
        nick: nick ?? null,
        location_lat: lat,
        location_lng: lng,
        avatar_config: avatar_config ?? null,
        avatar_url: avatar_url ?? null,
        tags: tags ?? null,
        bio: bio ?? null,
        is_active: is_active ?? true,
        last_bounce_at: last_bounce_at ?? null
      };
      onProfileUpdate(profile);
    }
  }, [currentUserId, onProfileUpdate, onBounceUpdate]);

  useEffect(() => {
    // Subscribe for EVERYONE (guests included) as long as we have coordinates
    if (!enabled || userLat === undefined || userLng === undefined) {
      return;
    }

    const channelKeys = getAdjacentChannelKeys(userLat, userLng, radiusMeters);
    console.log('[Broadcast] Subscribing to channels (guest-friendly):', channelKeys, { currentUserId: currentUserId ?? 'GUEST' });

    channelsRef.current = channelKeys.map(key => {
      const channel = supabase
        .channel(key)
        // New canonical event name
        .on('broadcast', { event: 'POS_UPDATE' }, handleBroadcast)
        // Backwards compatibility
        .on('broadcast', { event: 'profile_update' }, handleBroadcast)
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('[Broadcast] ✓ Subscribed to:', key);
          }
        });
      return channel;
    });

    return () => {
      console.log('[Broadcast] Cleaning up channels');
      channelsRef.current.forEach(channel => {
        supabase.removeChannel(channel);
      });
      channelsRef.current = [];
    };
  }, [enabled, currentUserId, userLat, userLng, radiusMeters, handleBroadcast]);

  return null;
};

/**
 * Broadcast a profile update to nearby users.
 * IMPORTANT: Include FULL profile data so receivers don't need RPC calls.
 * 
 * @param profile - Full profile data including avatar_config, nick, etc.
 * @param lat - Current latitude
 * @param lng - Current longitude  
 * @param eventType - Type of update
 */
export const broadcastProfileUpdate = async (
  profile: {
    id: string;
    nick?: string | null;
    avatar_config?: any;
    avatar_url?: string | null;
    tags?: string[] | null;
    bio?: string | null;
    is_active?: boolean;
    last_bounce_at?: string | null;
  },
  lat: number,
  lng: number,
  eventType: 'location_update' | 'bounce' | 'status_change' = 'location_update'
) => {
  const channelKey = getChannelKey(lat, lng);
  
  console.log('[Broadcast] Sending update to channel:', channelKey, { userId: profile.id, eventType });
  
  const channel = supabase.channel(channelKey);
  
  const payload: ProfileBroadcastPayload = {
    user_id: profile.id,
    event_type: eventType,
    lat,
    lng,
    timestamp: new Date().toISOString(),
    // Include full avatar data for direct rendering
    nick: profile.nick,
    avatar_config: profile.avatar_config,
    avatar_url: profile.avatar_url,
    tags: profile.tags,
    bio: profile.bio,
    is_active: profile.is_active ?? true,
    last_bounce_at: profile.last_bounce_at
  };
  
  await channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      channel.send({
        type: 'broadcast',
        event: 'POS_UPDATE',
        payload
      });
      
      // Cleanup after sending
      setTimeout(() => {
        supabase.removeChannel(channel);
      }, 1000);
    }
  });
};

/**
 * Legacy wrapper for simple broadcast calls.
 * Fetches current user's profile and broadcasts it.
 */
export const broadcastCurrentUserUpdate = async (
  userId: string,
  lat: number,
  lng: number,
  eventType: 'location_update' | 'bounce' | 'status_change' = 'location_update'
) => {
  // Fetch current user's profile data for the broadcast
  const { data } = await supabase
    .from('profiles')
    .select('nick, avatar_config, avatar_url, tags, bio, is_active, last_bounce_at')
    .eq('id', userId)
    .single();
  
  if (!data) {
    console.error('[Broadcast] Failed to fetch profile for broadcast');
    return;
  }
  
  await broadcastProfileUpdate(
    {
      id: userId,
      nick: data.nick,
      avatar_config: data.avatar_config,
      avatar_url: data.avatar_url,
      tags: data.tags,
      bio: data.bio,
      is_active: data.is_active,
      last_bounce_at: data.last_bounce_at
    },
    lat,
    lng,
    eventType
  );
};
