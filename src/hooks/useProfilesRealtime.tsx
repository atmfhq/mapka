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
  onLocationUpdate?: (userId: string) => void;
  onBounceUpdate?: (userId: string, bounceAt: string) => void;
  enabled?: boolean;
}

export const useProfilesRealtime = ({
  onLocationUpdate,
  onBounceUpdate,
  enabled = true
}: UseProfilesRealtimeOptions) => {
  const lastBounceTimestamps = useRef<Map<string, string>>(new Map());

  const handleProfileChange = useCallback((
    payload: RealtimePostgresChangesPayload<ProfilePayload>
  ) => {
    if (payload.eventType !== 'UPDATE') return;
    
    const newRecord = payload.new as ProfilePayload;
    const oldRecord = payload.old as ProfilePayload;
    
    if (!newRecord?.id) return;

    console.log('[Realtime] Profile update received:', {
      userId: newRecord.id,
      nick: newRecord.nick,
      locationChanged: oldRecord?.location_lat !== newRecord.location_lat || 
                       oldRecord?.location_lng !== newRecord.location_lng,
      bounceChanged: oldRecord?.last_bounce_at !== newRecord.last_bounce_at
    });

    // Check if location changed (teleport)
    const locationChanged = 
      oldRecord?.location_lat !== newRecord.location_lat ||
      oldRecord?.location_lng !== newRecord.location_lng;
    
    if (locationChanged && onLocationUpdate) {
      console.log('[Realtime] Location update detected for user:', newRecord.id);
      onLocationUpdate(newRecord.id);
    }

    // Check if bounce happened
    const lastKnownBounce = lastBounceTimestamps.current.get(newRecord.id);
    const currentBounce = newRecord.last_bounce_at;
    
    if (currentBounce && currentBounce !== lastKnownBounce) {
      console.log('[Realtime] Bounce detected for user:', newRecord.id);
      lastBounceTimestamps.current.set(newRecord.id, currentBounce);
      
      if (onBounceUpdate) {
        onBounceUpdate(newRecord.id, currentBounce);
      }
    }
  }, [onLocationUpdate, onBounceUpdate]);

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
