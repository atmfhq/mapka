import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { safeRemoveChannel } from '@/lib/realtimeUtils';

/**
 * Realtime broadcast protocol (MUST match sender + receiver).
 */
export const REALTIME_CHANNEL = 'global_map_v1';
export const EVENT_NAME = 'POS_UPDATE';

const MAX_DISTANCE_METERS = 50_000; // 50km client-side filter

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

export const CHAT_EVENT = 'chat-message';

export interface ChatBubblePayload {
  user_id: string;
  message: string;
  timestamp: string;
}

interface UseProfilesRealtimeOptions {
  /** Current user's ID */
  currentUserId?: string | null;
  /** Current user's lat/lng (used ONLY for client-side filtering) */
  userLat?: number;
  userLng?: number;
  /** (kept for API compatibility, not used for channel selection anymore) */
  radiusMeters?: number;
  /** Called with the updated profile data for surgical marker updates */
  onProfileUpdate?: (profile: ProfileData) => void;
  /** Called when a bounce is detected */
  onBounceUpdate?: (userId: string, bounceAt: string) => void;
  /** Called when a chat bubble is received */
  onChatBubble?: (payload: ChatBubblePayload) => void;
  enabled?: boolean;
}

const toRad = (deg: number) => (deg * Math.PI) / 180;

// Haversine distance in meters
const distanceMeters = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371_000; // meters
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const useProfilesRealtime = ({
  currentUserId,
  userLat,
  userLng,
  onProfileUpdate,
  onBounceUpdate,
  onChatBubble,
  enabled = true,
}: UseProfilesRealtimeOptions) => {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastBounceTimestamps = useRef<Map<string, string>>(new Map());

  // Refs to avoid stale closures without re-subscribing
  const enabledRef = useRef(enabled);
  const currentUserIdRef = useRef<string | null | undefined>(currentUserId);
  const userCoordsRef = useRef<{ lat?: number; lng?: number }>({ lat: userLat, lng: userLng });
  const onProfileUpdateRef = useRef(onProfileUpdate);
  const onBounceUpdateRef = useRef(onBounceUpdate);
  const onChatBubbleRef = useRef(onChatBubble);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  useEffect(() => {
    userCoordsRef.current = { lat: userLat, lng: userLng };
  }, [userLat, userLng]);

  useEffect(() => {
    onProfileUpdateRef.current = onProfileUpdate;
  }, [onProfileUpdate]);

  useEffect(() => {
    onBounceUpdateRef.current = onBounceUpdate;
  }, [onBounceUpdate]);

  useEffect(() => {
    onChatBubbleRef.current = onChatBubble;
  }, [onChatBubble]);

  // Stable handler: uses refs only (no stale closures, no resubscribe)
  // CRITICAL: No dependencies that change - this runs ONCE
  const handleBroadcast = useCallback((raw: any) => {
    if (!enabledRef.current) return;

    const payload: ProfileBroadcastPayload | undefined = raw?.payload;
    if (!payload) return;

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
      last_bounce_at,
    } = payload;

    // Skip our own broadcasts (only if logged in)
    const me = currentUserIdRef.current;
    if (me && user_id === me) return;

    console.log('📥 RECEIVED Broadcast on', REALTIME_CHANNEL, payload);

    // Client-side distance filter (inline, no dependency)
    const { lat: myLat, lng: myLng } = userCoordsRef.current;
    if (myLat !== undefined && myLng !== undefined) {
      const R = 6371_000;
      const dLat = ((lat - myLat) * Math.PI) / 180;
      const dLng = ((lng - myLng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((myLat * Math.PI) / 180) *
          Math.cos((lat * Math.PI) / 180) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      if (d > MAX_DISTANCE_METERS) {
        console.log('[Broadcast] Ignoring event (too far):', { d_meters: Math.round(d) });
        return;
      }
    }

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
      last_bounce_at: last_bounce_at ?? null,
    };

    if (event_type === 'location_update' || event_type === 'status_change') {
      onProfileUpdateRef.current?.(profile);
    }

    if (event_type === 'bounce') {
      const lastKnownBounce = lastBounceTimestamps.current.get(user_id);
      if (timestamp !== lastKnownBounce) {
        lastBounceTimestamps.current.set(user_id, timestamp);
        onBounceUpdateRef.current?.(user_id, timestamp);
      }
    }
  }, []); // EMPTY deps - stable forever

  // Chat message handler - separate from position updates
  const handleChatBroadcast = useCallback((raw: any) => {
    if (!enabledRef.current) return;

    const payload: ChatBubblePayload | undefined = raw?.payload;
    if (!payload) return;

    console.log('💬 RECEIVED Chat bubble on', REALTIME_CHANNEL, payload);

    // Don't filter own messages - let BubbleChat handle that for instant display
    onChatBubbleRef.current?.(payload);
  }, []);

  // Connect ONCE on mount, clean up on unmount.
  // CRITICAL: Empty dependency array - subscribe exactly once
  useEffect(() => {
    console.log('[Broadcast] Setting up GLOBAL subscription:', REALTIME_CHANNEL);
    
    // IMPORTANT: Broadcast must use a STABLE channel name shared across clients.
    // Do NOT use getOrCreateChannel() here because it creates unique local channel names,
    // which would put each client in a different broadcast room.
    const channel = supabase.channel(REALTIME_CHANNEL);
    channelRef.current = channel;

    // Attach handlers and subscribe
    channel
      .on('broadcast', { event: EVENT_NAME }, handleBroadcast)
      .on('broadcast', { event: CHAT_EVENT }, handleChatBroadcast)
      .subscribe((status) => {
        console.log('[Broadcast] Global subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('[Broadcast] ✅ Subscribed to global channel');
        }
      });

    return () => {
      console.log('[Broadcast] Cleaning up GLOBAL subscription');
      if (channelRef.current) {
        safeRemoveChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []); // EMPTY deps - mount once

  // Send a chat message via the shared channel
  const sendChatMessage = useCallback((message: string) => {
    const userId = currentUserIdRef.current;
    if (!userId || !channelRef.current) {
      console.warn('[useProfilesRealtime] Cannot send chat - no user or channel');
      return;
    }

    const payload: ChatBubblePayload = {
      user_id: userId,
      message,
      timestamp: new Date().toISOString(),
    };

    console.log('💬 SENDING Chat bubble to', REALTIME_CHANNEL, payload);
    channelRef.current.send({ type: 'broadcast', event: CHAT_EVENT, payload });
  }, []);

  return { sendChatMessage };
};

/**
 * Broadcast a profile update to the GLOBAL room.
 * IMPORTANT: Include FULL profile data so receivers don't need RPC calls.
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
  const payload: ProfileBroadcastPayload = {
    user_id: profile.id,
    event_type: eventType,
    lat,
    lng,
    timestamp: new Date().toISOString(),
    nick: profile.nick,
    avatar_config: profile.avatar_config,
    avatar_url: profile.avatar_url,
    tags: profile.tags,
    bio: profile.bio,
    is_active: profile.is_active ?? true,
    last_bounce_at: profile.last_bounce_at,
  };

  console.log('📡 SENDING Broadcast to', REALTIME_CHANNEL, payload);

  // IMPORTANT: Broadcast must use the stable global room name.
  // For one-off sends we create a short-lived channel and clean it up after sending.
  const channel = supabase.channel(REALTIME_CHANNEL);
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      channel.send({ type: 'broadcast', event: EVENT_NAME, payload });
      try {
        supabase.removeChannel(channel);
      } catch {
        // ignore
      }
    }
  });
};

/**
 * Wrapper for simple broadcast calls.
 * Fetches current user's profile and broadcasts it.
 */
export const broadcastCurrentUserUpdate = async (
  userId: string,
  lat: number,
  lng: number,
  eventType: 'location_update' | 'bounce' | 'status_change' = 'location_update'
) => {
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
      last_bounce_at: data.last_bounce_at,
    },
    lat,
    lng,
    eventType
  );
};
