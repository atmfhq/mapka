import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ShoutCounts {
  likesCount: number;
  commentsCount: number;
}

export const useShoutCounts = (shoutIds: string[]) => {
  const [countsMap, setCountsMap] = useState<Record<string, ShoutCounts>>({});

  const fetchCounts = useCallback(async () => {
    if (shoutIds.length === 0) {
      setCountsMap({});
      return;
    }

    try {
      // Fetch likes counts
      const { data: likesData, error: likesError } = await supabase
        .from('shout_likes')
        .select('shout_id')
        .in('shout_id', shoutIds);

      if (likesError) throw likesError;

      // Fetch comments counts
      const { data: commentsData, error: commentsError } = await supabase
        .from('shout_comments')
        .select('shout_id')
        .in('shout_id', shoutIds);

      if (commentsError) throw commentsError;

      // Build counts map
      const newCounts: Record<string, ShoutCounts> = {};
      
      shoutIds.forEach(id => {
        const likesCount = likesData?.filter(l => l.shout_id === id).length || 0;
        const commentsCount = commentsData?.filter(c => c.shout_id === id).length || 0;
        newCounts[id] = { likesCount, commentsCount };
      });

      setCountsMap(newCounts);
    } catch (error) {
      console.error('Error fetching shout counts:', error);
    }
  }, [shoutIds.join(',')]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  // Realtime subscriptions for likes and comments
  useEffect(() => {
    if (shoutIds.length === 0) return;

    const channel = supabase
      .channel('shout-counts-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shout_likes',
        },
        (payload) => {
          const shoutId = (payload.new as any)?.shout_id || (payload.old as any)?.shout_id;
          if (shoutId && shoutIds.includes(shoutId)) {
            fetchCounts();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shout_comments',
        },
        (payload) => {
          const shoutId = (payload.new as any)?.shout_id || (payload.old as any)?.shout_id;
          if (shoutId && shoutIds.includes(shoutId)) {
            fetchCounts();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [shoutIds.join(','), fetchCounts]);

  const getCounts = useCallback((shoutId: string): ShoutCounts => {
    return countsMap[shoutId] || { likesCount: 0, commentsCount: 0 };
  }, [countsMap]);

  return { getCounts, countsMap, refetch: fetchCounts };
};
