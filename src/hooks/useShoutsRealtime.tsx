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

export const useShoutsRealtime = (centerLat: number, centerLng: number) => {
  const [shouts, setShouts] = useState<Shout[]>([]);

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

  useEffect(() => {
    fetchShouts();

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
  }, [fetchShouts]);

  // Filter out expired shouts client-side (24 hour lifetime)
  const activeShouts = shouts.filter((shout) => {
    const createdAt = new Date(shout.created_at).getTime();
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    return now - createdAt < twentyFourHours;
  });

  return { shouts: activeShouts, refetch: fetchShouts };
};
