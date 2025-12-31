import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Shout {
  id: string;
  user_id: string;
  content: string;
  lat: number;
  lng: number;
  created_at: string;
}

interface UseShoutsRealtimeOptions {
  onNewItemsInRange?: (newShouts: Shout[], allShouts: Shout[]) => void;
}

export const useShoutsRealtime = (
  centerLat: number, 
  centerLng: number, 
  userId?: string,
  options?: UseShoutsRealtimeOptions
) => {
  const [shouts, setShouts] = useState<Shout[]>([]);
  const [hiddenShoutIds, setHiddenShoutIds] = useState<Set<string>>(new Set());
  const previousShoutIdsRef = useRef<Set<string>>(new Set());
  const lastLocationRef = useRef({ lat: centerLat, lng: centerLng });

  // Fetch hidden shouts for the current user
  const fetchHiddenShouts = useCallback(async () => {
    if (!userId) {
      setHiddenShoutIds(new Set());
      return;
    }

    const { data, error } = await supabase
      .from('hidden_shouts')
      .select('shout_id')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching hidden shouts:', error);
      return;
    }

    setHiddenShoutIds(new Set(data?.map(h => h.shout_id) || []));
  }, [userId]);

  // Fetch shouts using the new RPC with strict radius enforcement
  const fetchShouts = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_nearby_shouts', {
      p_lat: centerLat,
      p_lng: centerLng,
      p_radius_meters: 5000 // 5km strict radius
    });

    if (error) {
      console.error('Error fetching nearby shouts:', error);
      return;
    }

    const newShouts = (data || []) as Shout[];
    const newShoutIds = new Set(newShouts.map(s => s.id));
    
    // Detect newly appeared shouts (for proximity alerts)
    const previousIds = previousShoutIdsRef.current;
    const newlyAppeared = newShouts.filter(s => !previousIds.has(s.id));
    
    // Check if location actually changed (not just initial load)
    const locationChanged = 
      lastLocationRef.current.lat !== centerLat || 
      lastLocationRef.current.lng !== centerLng;
    
    // Only trigger callback if there are new items AND location changed
    if (newlyAppeared.length > 0 && locationChanged && options?.onNewItemsInRange) {
      options.onNewItemsInRange(newlyAppeared, newShouts);
    }
    
    // Update refs
    previousShoutIdsRef.current = newShoutIds;
    lastLocationRef.current = { lat: centerLat, lng: centerLng };
    
    setShouts(newShouts);
  }, [centerLat, centerLng, options]);

  // Hide a shout for the current user
  const hideShout = useCallback(async (shoutId: string) => {
    if (!userId) return false;

    const { error } = await supabase
      .from('hidden_shouts')
      .insert({ user_id: userId, shout_id: shoutId });

    if (error) {
      console.error('Error hiding shout:', error);
      return false;
    }

    // Immediately update local state
    setHiddenShoutIds(prev => new Set([...prev, shoutId]));
    return true;
  }, [userId]);

  useEffect(() => {
    fetchShouts();
    fetchHiddenShouts();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('shouts-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'shouts',
        },
        (payload) => {
          const newShout = payload.new as Shout;
          
          // Check if the new shout is within our radius (client-side check)
          // This is a quick estimate - the full refetch will enforce server-side
          const distance = Math.sqrt(
            Math.pow(newShout.lat - centerLat, 2) + 
            Math.pow(newShout.lng - centerLng, 2)
          ) * 111000; // Rough meters conversion
          
          if (distance <= 5000) {
            setShouts((prev) => {
              if (prev.some(s => s.id === newShout.id)) return prev;
              return [newShout, ...prev];
            });
            
            // Track as seen for proximity alerts
            previousShoutIdsRef.current.add(newShout.id);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'shouts',
        },
        (payload) => {
          const deletedId = payload.old?.id;
          if (deletedId) {
            setShouts((prev) => prev.filter((s) => s.id !== deletedId));
            previousShoutIdsRef.current.delete(deletedId);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchShouts, fetchHiddenShouts, centerLat, centerLng]);

  // Refetch when location changes significantly
  useEffect(() => {
    const distance = Math.sqrt(
      Math.pow(lastLocationRef.current.lat - centerLat, 2) + 
      Math.pow(lastLocationRef.current.lng - centerLng, 2)
    ) * 111000;
    
    // Refetch if moved more than 500m
    if (distance > 500) {
      fetchShouts();
    }
  }, [centerLat, centerLng, fetchShouts]);

  // Filter out hidden shouts client-side
  const activeShouts = shouts.filter((shout) => {
    return !hiddenShoutIds.has(shout.id);
  });

  return { shouts: activeShouts, refetch: fetchShouts, hideShout };
};

