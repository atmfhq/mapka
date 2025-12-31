import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
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

// Simple haversine distance check (meters)
const getDistanceMeters = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + 
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const useShoutsRealtime = (
  centerLat: number, 
  centerLng: number, 
  userId?: string,
  options?: UseShoutsRealtimeOptions
) => {
  const [shouts, setShouts] = useState<Shout[]>([]);
  const [hiddenShoutIds, setHiddenShoutIds] = useState<Set<string>>(new Set());
  
  // Track fetch state to prevent duplicate requests
  const isFetchingRef = useRef(false);
  const lastFetchLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const previousShoutIdsRef = useRef<Set<string>>(new Set());
  const optionsRef = useRef(options);
  
  // Keep options ref updated
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // Stable fetch function that checks for duplicate requests
  const fetchShouts = useCallback(async (lat: number, lng: number, force = false) => {
    // Skip if already fetching
    if (isFetchingRef.current && !force) return;
    
    // Skip if location hasn't changed significantly (within 50m)
    if (!force && lastFetchLocationRef.current) {
      const distance = getDistanceMeters(
        lastFetchLocationRef.current.lat,
        lastFetchLocationRef.current.lng,
        lat,
        lng
      );
      if (distance < 50) return;
    }
    
    isFetchingRef.current = true;
    lastFetchLocationRef.current = { lat, lng };

    try {
      const { data, error } = await supabase.rpc('get_nearby_shouts', {
        p_lat: lat,
        p_lng: lng,
        p_radius_meters: 5000
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
      
      // Only trigger callback if there are new items AND we had previous data
      if (newlyAppeared.length > 0 && previousIds.size > 0 && optionsRef.current?.onNewItemsInRange) {
        optionsRef.current.onNewItemsInRange(newlyAppeared, newShouts);
      }
      
      // Update ref
      previousShoutIdsRef.current = newShoutIds;
      
      setShouts(newShouts);
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  // Fetch hidden shouts for the current user - runs once on userId change
  useEffect(() => {
    if (!userId) {
      setHiddenShoutIds(new Set());
      return;
    }

    const fetchHidden = async () => {
      const { data, error } = await supabase
        .from('hidden_shouts')
        .select('shout_id')
        .eq('user_id', userId);

      if (!error && data) {
        setHiddenShoutIds(new Set(data.map(h => h.shout_id)));
      }
    };

    fetchHidden();
  }, [userId]);

  // Initial fetch + realtime subscription - runs ONCE on mount
  useEffect(() => {
    // Initial fetch
    fetchShouts(centerLat, centerLng, true);

    // Subscribe to realtime changes
    const channel = supabase
      .channel('shouts-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'shouts' },
        (payload) => {
          const newShout = payload.new as Shout;
          
          // Quick client-side distance check
          const distance = getDistanceMeters(newShout.lat, newShout.lng, centerLat, centerLng);
          
          if (distance <= 5000) {
            setShouts((prev) => {
              if (prev.some(s => s.id === newShout.id)) return prev;
              return [newShout, ...prev];
            });
            previousShoutIdsRef.current.add(newShout.id);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'shouts' },
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
    // Intentionally only run on mount - location changes handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch when location changes significantly (500m threshold)
  useEffect(() => {
    if (!lastFetchLocationRef.current) return;
    
    const distance = getDistanceMeters(
      lastFetchLocationRef.current.lat,
      lastFetchLocationRef.current.lng,
      centerLat,
      centerLng
    );
    
    if (distance > 500) {
      fetchShouts(centerLat, centerLng);
    }
  }, [centerLat, centerLng, fetchShouts]);

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

    setHiddenShoutIds(prev => new Set([...prev, shoutId]));
    return true;
  }, [userId]);

  // Filter out hidden shouts - memoized
  const activeShouts = useMemo(() => {
    return shouts.filter((shout) => !hiddenShoutIds.has(shout.id));
  }, [shouts, hiddenShoutIds]);

  // Stable refetch function for external use
  const refetch = useCallback(() => {
    fetchShouts(centerLat, centerLng, true);
  }, [fetchShouts, centerLat, centerLng]);

  return { shouts: activeShouts, refetch, hideShout };
};
