import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getOrCreateChannel, safeRemoveChannel } from '@/lib/realtimeUtils';

interface ShoutCounts {
  likesCount: number;
  commentsCount: number;
}

export const useShoutCounts = (shoutIds: string[]) => {
  const [countsMap, setCountsMap] = useState<Record<string, ShoutCounts>>({});
  const shoutIdsRef = useRef(shoutIds);
  const fetchCountsRef = useRef<() => void>(() => {});
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    shoutIdsRef.current = shoutIds;
  }, [shoutIds.join(',')]);

  const fetchCounts = useCallback(async () => {
    const currentShoutIds = shoutIdsRef.current;
    if (currentShoutIds.length === 0) {
      setCountsMap({});
      return;
    }

    console.log('[useShoutCounts] 🔄 Refetching counts for', currentShoutIds.length, 'shouts');
    try {
      const { data: likesData, error: likesError } = await supabase
        .from('shout_likes')
        .select('shout_id')
        .in('shout_id', currentShoutIds);

      if (likesError) throw likesError;

      const { data: commentsData, error: commentsError } = await supabase
        .from('shout_comments')
        .select('shout_id')
        .in('shout_id', currentShoutIds);

      if (commentsError) throw commentsError;

      const newCounts: Record<string, ShoutCounts> = {};
      
      currentShoutIds.forEach(id => {
        const idStr = String(id);
        const likesCount = likesData?.filter(l => String(l.shout_id) === idStr).length || 0;
        const commentsCount = commentsData?.filter(c => String(c.shout_id) === idStr).length || 0;
        newCounts[idStr] = { likesCount, commentsCount };
      });

      console.log('[useShoutCounts] ✅ Updated counts:', Object.keys(newCounts).length, 'shouts');
      setCountsMap(newCounts);
    } catch (error) {
      console.error('[useShoutCounts] ❌ Error fetching shout counts:', error);
    }
  }, []);

  // Keep a ref to avoid stale closures in realtime handler
  useEffect(() => {
    fetchCountsRef.current = () => {
      fetchCounts();
    };
  }, [fetchCounts]);

  const scheduleRefetch = useCallback(() => {
    if (refetchTimerRef.current) {
      clearTimeout(refetchTimerRef.current);
    }
    // Small debounce to collapse bursts (e.g. optimistic + realtime, rapid toggles)
    refetchTimerRef.current = setTimeout(() => {
      fetchCountsRef.current();
      refetchTimerRef.current = null;
    }, 100);
  }, []);

  useEffect(() => {
    fetchCounts();
  }, [shoutIds.join(','), fetchCounts]);

  // Realtime subscriptions - use stable channel name to avoid recreation when shoutIds change
  // The filtering is done in the handler using shoutIdsRef which is always up-to-date
  useEffect(() => {
    // Subscribe globally to shout likes and comments changes
    // Filter by shoutIds in the handler (not in channel name) to avoid subscription recreation
    const channelName = 'shout-counts-global';
    
    // Get or create channel - ALWAYS attach handlers, only subscribe if needed
    const { channel, shouldSubscribe } = getOrCreateChannel(channelName);
    
    console.log('[useShoutCounts] Setting up subscription:', channelName);
    
    channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'shout_likes',
        },
        () => scheduleRefetch()
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'shout_likes',
        },
        () => scheduleRefetch()
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'shout_comments',
        },
        () => scheduleRefetch()
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'shout_comments',
        },
        () => scheduleRefetch()
      );
    
    // Subscribe to the channel
    channel.subscribe((status) => {
      console.log('[useShoutCounts] 📡 Subscription status:', status);
      if (status === 'SUBSCRIBED') {
        console.log('[useShoutCounts] ✅ Subscribed');
      }
    });

    return () => {
      safeRemoveChannel(channel);
      if (refetchTimerRef.current) {
        clearTimeout(refetchTimerRef.current);
        refetchTimerRef.current = null;
      }
    };
  }, [scheduleRefetch]); // subscribe once; scheduleRefetch is stable

  const getCounts = useCallback((shoutId: string): ShoutCounts => {
    return countsMap[String(shoutId)] || { likesCount: 0, commentsCount: 0 };
  }, [countsMap]);

  return { getCounts, countsMap, refetch: fetchCounts };
};
