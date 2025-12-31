import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Shout {
  id: string;
  user_id: string;
  content: string;
  lat: number;
  lng: number;
  created_at: string;
}

export const useShoutsRealtime = (centerLat: number, centerLng: number, userId?: string) => {
  const [shouts, setShouts] = useState<Shout[]>([]);
  const [hiddenShoutIds, setHiddenShoutIds] = useState<Set<string>>(new Set());

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

  const fetchShouts = useCallback(async () => {
    // Fetch shouts that are less than 24 hours old (RLS handles this)
    const { data, error } = await supabase
      .from('shouts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching shouts:', error);
      return;
    }

    setShouts(data || []);
  }, []);

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
          setShouts((prev) => [newShout, ...prev]);
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
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchShouts, fetchHiddenShouts]);

  // Filter out expired shouts and hidden shouts client-side
  const activeShouts = shouts.filter((shout) => {
    // Filter out hidden shouts
    if (hiddenShoutIds.has(shout.id)) return false;
    
    // Filter out expired shouts (24 hour lifetime)
    const createdAt = new Date(shout.created_at).getTime();
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    return now - createdAt < twentyFourHours;
  });

  return { shouts: activeShouts, refetch: fetchShouts, hideShout };
};
