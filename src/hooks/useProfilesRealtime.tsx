import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface ProfilePayload {
  id: string;
  nick: string | null;
  location_lat: number | null;
  location_lng: number | null;
  last_bounce_at: string | null;
  is_active: boolean;
  avatar_config: any;
  tags: string[] | null;
  bio: string | null;
}

interface UseProfilesRealtimeOptions {
  /** Called with the full updated profile data for surgical marker updates */
  onProfileUpdate?: (profile: ProfilePayload) => void;
  /** Called when a bounce is detected */
  onBounceUpdate?: (userId: string, bounceAt: string) => void;
  enabled?: boolean;
}

export const useProfilesRealtime = ({
  onProfileUpdate,
  onBounceUpdate,
  enabled = true
}: UseProfilesRealtimeOptions) => {
  const lastBounceTimestamps = useRef<Map<string, string>>(new Map());
  const lastLocationTimestamps = useRef<Map<string, string>>(new Map());

  const handleProfileChange = useCallback((
    payload: RealtimePostgresChangesPayload<ProfilePayload>
  ) => {
    if (payload.eventType !== 'UPDATE') return;
    
    const newRecord = payload.new as ProfilePayload;
    const oldRecord = payload.old as ProfilePayload;
    
    if (!newRecord?.id) return;

    const locationChanged = 
      oldRecord?.location_lat !== newRecord.location_lat ||
      oldRecord?.location_lng !== newRecord.location_lng;
    
    const bounceChanged = oldRecord?.last_bounce_at !== newRecord.last_bounce_at;

    console.log('[Realtime] Profile update received:', {
      userId: newRecord.id,
      nick: newRecord.nick,
      locationChanged,
      bounceChanged,
      newLat: newRecord.location_lat,
      newLng: newRecord.location_lng
    });

    // Handle location change - send full profile for surgical update
    if (locationChanged && onProfileUpdate) {
      console.log('[Realtime] ✓ Surgical location update for user:', newRecord.id);
      onProfileUpdate(newRecord);
    }

    // Handle bounce - trigger animation
    const lastKnownBounce = lastBounceTimestamps.current.get(newRecord.id);
    const currentBounce = newRecord.last_bounce_at;
    
    if (currentBounce && currentBounce !== lastKnownBounce) {
      console.log('[Realtime] ✓ Bounce detected for user:', newRecord.id);
      lastBounceTimestamps.current.set(newRecord.id, currentBounce);
      
      if (onBounceUpdate) {
        onBounceUpdate(newRecord.id, currentBounce);
      }
    }

    // Also trigger profile update for is_active changes
    if (oldRecord?.is_active !== newRecord.is_active && onProfileUpdate) {
      console.log('[Realtime] ✓ Active status changed for user:', newRecord.id);
      onProfileUpdate(newRecord);
    }
  }, [onProfileUpdate, onBounceUpdate]);

  useEffect(() => {
    if (!enabled) return;

    console.log('[Realtime] Connecting to profiles channel...');

    const channel = supabase
      .channel('profiles-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles'
        },
        handleProfileChange
      )
      .subscribe((status) => {
        console.log('[Realtime] Channel status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] ✓ Connected to profiles realtime channel');
        }
      });

    return () => {
      console.log('[Realtime] Disconnecting from profiles channel');
      supabase.removeChannel(channel);
    };
  }, [enabled, handleProfileChange]);

  return null;
};
