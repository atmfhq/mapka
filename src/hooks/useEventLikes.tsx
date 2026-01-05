import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';
import { useMapRefetch } from './useMapRefetch';
import { getOrCreateChannel, safeRemoveChannel } from '@/lib/realtimeUtils';

interface EventLikeState {
  count: number;
  isLiked: boolean;
  isLoading: boolean;
}

export const useEventLikes = (eventId: string | null, userId: string | null) => {
  const [state, setState] = useState<EventLikeState>({
    count: 0,
    isLiked: false,
    isLoading: true,
  });
  const eventIdRef = useRef(eventId);
  const userIdRef = useRef(userId);
  const queryClient = useQueryClient();
  const { triggerEventRefetch } = useMapRefetch();

  useEffect(() => {
    eventIdRef.current = eventId;
  }, [eventId]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  const fetchLikeState = useCallback(async () => {
    const currentEventId = eventIdRef.current;
    if (!currentEventId) {
      setState({ count: 0, isLiked: false, isLoading: false });
      return;
    }

    try {
      const { count, error: countError } = await supabase
        .from('event_likes')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', currentEventId);

      if (countError) throw countError;

      let isLiked = false;
      if (userIdRef.current) {
        const { data: userLike, error: likeError } = await supabase
          .from('event_likes')
          .select('id')
          .eq('event_id', currentEventId)
          .eq('user_id', userIdRef.current)
          .maybeSingle();

        if (!likeError && userLike) {
          isLiked = true;
        }
      }

      setState({
        count: count || 0,
        isLiked,
        isLoading: false,
      });
    } catch (error) {
      console.error('Error fetching like state:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    fetchLikeState();
  }, [eventId, userId, fetchLikeState]);

  // Realtime subscription - use stable channel name, filter in handler
  useEffect(() => {
    const channelName = 'event-likes-single-global';
    
    // Check if channel already exists to prevent CHANNEL_ERROR
    const { channel, shouldSubscribe } = getOrCreateChannel(channelName);
    
    if (!shouldSubscribe) {
      console.log('[useEventLikes] Channel already subscribed:', channelName);
      return;
    }
    
    channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'event_likes',
        },
        (payload) => {
          const newLike = payload.new as { event_id: string; user_id: string };
          
          if (!eventIdRef.current || String(newLike.event_id) !== String(eventIdRef.current)) {
            return;
          }

          console.log('[useEventLikes] 🔔 Like INSERT for event:', eventIdRef.current);
          setState(prev => ({
            ...prev,
            count: prev.count + 1,
            isLiked: userIdRef.current === newLike.user_id ? true : prev.isLiked,
          }));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'event_likes',
        },
        (payload) => {
          const oldLike = payload.old as { event_id: string; user_id: string };
          
          if (!eventIdRef.current || String(oldLike.event_id) !== String(eventIdRef.current)) {
            return;
          }

          console.log('[useEventLikes] 🔔 Like DELETE for event:', eventIdRef.current);
          setState(prev => ({
            ...prev,
            count: Math.max(0, prev.count - 1),
            isLiked: userIdRef.current === oldLike.user_id ? false : prev.isLiked,
          }));
        }
      )
    channel.subscribe((status) => {
      console.log('[useEventLikes] 📡 Subscription status:', status);
      if (status === 'SUBSCRIBED') {
        console.log('[useEventLikes] ✅ Subscribed');
      }
    });

    return () => {
      safeRemoveChannel(channel);
    };
  }, []); // Empty deps - subscribe once, filter in handler

  const toggleLike = useCallback(async () => {
    const currentEventId = eventIdRef.current;
    const currentUserId = userIdRef.current;
    
    if (!currentEventId || !currentUserId) return;

    let previousState: { count: number; isLiked: boolean; isLoading: boolean } | null = null;
    
    setState(prev => {
      previousState = prev;
      return {
        ...prev,
        isLiked: !prev.isLiked,
        count: prev.isLiked ? prev.count - 1 : prev.count + 1,
      };
    });

    try {
      if (previousState?.isLiked) {
        const { error } = await supabase
          .from('event_likes')
          .delete()
          .eq('event_id', currentEventId)
          .eq('user_id', currentUserId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('event_likes')
          .insert({ event_id: currentEventId, user_id: currentUserId });

        if (error) throw error;
      }

      // Invalidate queries to trigger map updates
      queryClient.invalidateQueries({ queryKey: queryKeys.allEvents() });
      triggerEventRefetch();
    } catch (error) {
      console.error('Error toggling like:', error);
      if (previousState) {
        setState(previousState);
      } else {
        fetchLikeState();
      }
    }
  }, [fetchLikeState, queryClient, triggerEventRefetch]);

  return {
    ...state,
    toggleLike,
    refetch: fetchLikeState,
  };
};

// Batch hook for multiple events
export const useMultipleEventLikes = (eventIds: string[], userId: string | null) => {
  const [likesMap, setLikesMap] = useState<Map<string, { count: number; isLiked: boolean }>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const eventIdsRef = useRef(eventIds);
  const userIdRef = useRef(userId);
  const queryClient = useQueryClient();
  const { triggerEventRefetch } = useMapRefetch();

  useEffect(() => {
    eventIdsRef.current = eventIds;
  }, [eventIds.join(',')]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  const fetchAllLikes = useCallback(async () => {
    const currentEventIds = eventIdsRef.current;
    if (currentEventIds.length === 0) {
      setLikesMap(new Map());
      setIsLoading(false);
      return;
    }

    try {
      const { data: allLikes, error } = await supabase
        .from('event_likes')
        .select('event_id, user_id')
        .in('event_id', currentEventIds);

      if (error) throw error;

      const newMap = new Map<string, { count: number; isLiked: boolean }>();
      
      currentEventIds.forEach(eventId => {
        const eventIdStr = String(eventId);
        const eventLikes = allLikes?.filter(l => String(l.event_id) === eventIdStr) || [];
        const isLiked = userIdRef.current ? eventLikes.some(l => l.user_id === userIdRef.current) : false;
        newMap.set(eventIdStr, { count: eventLikes.length, isLiked });
      });

      setLikesMap(newMap);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching likes:', error);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllLikes();
  }, [eventIds.join(','), userId, fetchAllLikes]);

  // Realtime subscription - use stable channel name, filter in handler
  useEffect(() => {
    const channelName = 'multiple-event-likes-global';
    
    // Check if channel already exists to prevent CHANNEL_ERROR
    const { channel, shouldSubscribe } = getOrCreateChannel(channelName);
    
    if (!shouldSubscribe) {
      console.log('[useMultipleEventLikes] Channel already subscribed:', channelName);
      return;
    }
    
    channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'event_likes',
        },
        (payload) => {
          const newLike = payload.new as { event_id: string; user_id: string };
          const eventIdStr = String(newLike.event_id);
          
          if (!eventIdsRef.current.map(String).includes(eventIdStr)) {
            return;
          }

          console.log('[useMultipleEventLikes] 🔔 Like INSERT for event:', eventIdStr);
          setLikesMap(prev => {
            const newMap = new Map(prev);
            const current = newMap.get(eventIdStr) || { count: 0, isLiked: false };
            newMap.set(eventIdStr, {
              count: current.count + 1,
              isLiked: userIdRef.current === newLike.user_id ? true : current.isLiked,
            });
            return newMap;
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'event_likes',
        },
        (payload) => {
          const oldLike = payload.old as { event_id: string; user_id: string };
          const eventIdStr = String(oldLike.event_id);
          
          if (!eventIdsRef.current.map(String).includes(eventIdStr)) {
            return;
          }

          console.log('[useMultipleEventLikes] 🔔 Like DELETE for event:', eventIdStr);
          setLikesMap(prev => {
            const newMap = new Map(prev);
            const current = newMap.get(eventIdStr) || { count: 0, isLiked: false };
            newMap.set(eventIdStr, {
              count: Math.max(0, current.count - 1),
              isLiked: userIdRef.current === oldLike.user_id ? false : current.isLiked,
            });
            return newMap;
          });
        }
      )
    channel.subscribe((status) => {
      console.log('[useMultipleEventLikes] 📡 Subscription status:', status);
      if (status === 'SUBSCRIBED') {
        console.log('[useMultipleEventLikes] ✅ Subscribed');
      }
    });

    return () => {
      safeRemoveChannel(channel);
    };
  }, []); // Empty deps - subscribe once, filter in handler

  const toggleLike = useCallback(async (eventId: string) => {
    if (!userIdRef.current) return;

    const eventIdStr = String(eventId);
    let previousState: { count: number; isLiked: boolean } | null = null;
    
    setLikesMap(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(eventIdStr) || { count: 0, isLiked: false };
      previousState = current;
      newMap.set(eventIdStr, {
        count: current.isLiked ? current.count - 1 : current.count + 1,
        isLiked: !current.isLiked,
      });
      return newMap;
    });

    try {
      if (previousState?.isLiked) {
        const { error } = await supabase
          .from('event_likes')
          .delete()
          .eq('event_id', eventId)
          .eq('user_id', userIdRef.current);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('event_likes')
          .insert({ event_id: eventId, user_id: userIdRef.current });
        if (error) throw error;
      }

      // Invalidate queries to trigger map updates
      queryClient.invalidateQueries({ queryKey: queryKeys.allEvents() });
      triggerEventRefetch();
    } catch (error) {
      console.error('Error toggling like:', error);
      if (previousState) {
        setLikesMap(prev => {
          const newMap = new Map(prev);
          newMap.set(eventIdStr, previousState!);
          return newMap;
        });
      } else {
        fetchAllLikes();
      }
    }
  }, [fetchAllLikes, queryClient, triggerEventRefetch]);

  const getLikeState = useCallback((eventId: string) => {
    return likesMap.get(String(eventId)) || { count: 0, isLiked: false };
  }, [likesMap]);

  return {
    getLikeState,
    toggleLike,
    isLoading,
    refetch: fetchAllLikes,
  };
};
