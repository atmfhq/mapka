import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ProfileBroadcast {
  user_id: string;
  event_type: 'location_update' | 'bounce' | 'status_change';
  lat?: number;
  lng?: number;
  timestamp: string;
}

interface ProfileData {
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

  // Fetch a single user's profile via RPC (fuzzed coords for non-self)
  // For guests: use get_nearby_profiles with a tiny radius centered on the user
  const fetchUserProfile = useCallback(async (userId: string, lat?: number, lng?: number) => {
    console.log('[Broadcast] Fetching profile for user:', userId);

    // If logged in, use the authenticated RPC
    if (currentUserId) {
      const { data, error } = await supabase.rpc('get_public_profiles_by_ids', {
        user_ids: [userId]
      });

      if (error) {
        console.error('[Broadcast] Error fetching profile:', error);
        return null;
      }

      if (data && data.length > 0) {
        console.log('[Broadcast] ✓ Got profile data:', data[0]);
        return data[0] as unknown as ProfileData;
      }
      return null;
    }

    // For guests: fetch nearby profiles using the broadcast coordinates
    // This works because get_nearby_profiles now allows anon access
    if (lat !== undefined && lng !== undefined) {
      const { data, error } = await supabase.rpc('get_nearby_profiles', {
        p_lat: lat,
        p_lng: lng,
        p_radius_meters: 500 // Small radius to get just this user's area
      });

      if (error) {
        console.error('[Broadcast] Error fetching profile for guest:', error);
        return null;
      }

      // Find the specific user in the results
      const profile = data?.find((p: any) => p.id === userId);
      if (profile) {
        console.log('[Broadcast] ✓ Got profile data for guest:', profile);
        return profile as unknown as ProfileData;
      }
    }

    return null;
  }, [currentUserId]);

  // Handle incoming broadcast message
  const handleBroadcast = useCallback(async (payload: { payload: ProfileBroadcast }) => {
    const { user_id, event_type, lat, lng, timestamp } = payload.payload;

    // Skip our own broadcasts (only if logged in)
    if (currentUserId && user_id === currentUserId) {
      console.log('[Broadcast] Ignoring own broadcast');
      return;
    }

    console.log('[Broadcast] Received:', { user_id, event_type, lat, lng });

    if (event_type === 'location_update' && onProfileUpdate) {
      // Fetch the user's profile (pass coords for guest fallback)
      const profile = await fetchUserProfile(user_id, lat, lng);
      if (profile) {
        onProfileUpdate(profile);
      }
    }

    if (event_type === 'bounce' && onBounceUpdate) {
      const lastKnownBounce = lastBounceTimestamps.current.get(user_id);
      if (timestamp !== lastKnownBounce) {
        lastBounceTimestamps.current.set(user_id, timestamp);
        onBounceUpdate(user_id, timestamp);
      }
    }

    if (event_type === 'status_change' && onProfileUpdate) {
      const profile = await fetchUserProfile(user_id, lat, lng);
      if (profile) {
        onProfileUpdate(profile);
      }
    }
  }, [currentUserId, onProfileUpdate, onBounceUpdate, fetchUserProfile]);

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

// Utility function to broadcast profile updates (call after DB update)
export const broadcastProfileUpdate = async (
  userId: string,
  lat: number,
  lng: number,
  eventType: 'location_update' | 'bounce' | 'status_change' = 'location_update'
) => {
  const channelKey = getChannelKey(lat, lng);
  
  console.log('[Broadcast] Sending update to channel:', channelKey, { userId, eventType });
  
  const channel = supabase.channel(channelKey);
  
  await channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      channel.send({
        type: 'broadcast',
        event: 'profile_update',
        payload: {
          user_id: userId,
          event_type: eventType,
          lat,
          lng,
          timestamp: new Date().toISOString()
        } as ProfileBroadcast
      });
      
      // Cleanup after sending
      setTimeout(() => {
        supabase.removeChannel(channel);
      }, 1000);
    }
  });
};
