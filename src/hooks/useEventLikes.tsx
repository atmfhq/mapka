import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

  const fetchLikeState = useCallback(async () => {
    if (!eventId) {
      setState({ count: 0, isLiked: false, isLoading: false });
      return;
    }

    try {
      // Fetch total count
      const { count, error: countError } = await supabase
        .from('event_likes')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId);

      if (countError) throw countError;

      // Check if current user has liked (only if authenticated)
      let isLiked = false;
      if (userId) {
        const { data: userLike, error: likeError } = await supabase
          .from('event_likes')
          .select('id')
          .eq('event_id', eventId)
          .eq('user_id', userId)
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
  }, [eventId, userId]);

  useEffect(() => {
    fetchLikeState();
  }, [fetchLikeState]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!eventId) return;

    const channel = supabase
      .channel(`event-likes-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_likes',
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          // Refetch on any change
          fetchLikeState();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, fetchLikeState]);

  const toggleLike = useCallback(async () => {
    if (!eventId || !userId) return;

    // Optimistic update
    setState(prev => ({
      ...prev,
      isLiked: !prev.isLiked,
      count: prev.isLiked ? prev.count - 1 : prev.count + 1,
    }));

    try {
      if (state.isLiked) {
        // Unlike
        const { error } = await supabase
          .from('event_likes')
          .delete()
          .eq('event_id', eventId)
          .eq('user_id', userId);

        if (error) throw error;
      } else {
        // Like
        const { error } = await supabase
          .from('event_likes')
          .insert({ event_id: eventId, user_id: userId });

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      // Revert on error
      setState(prev => ({
        ...prev,
        isLiked: !prev.isLiked,
        count: prev.isLiked ? prev.count + 1 : prev.count - 1,
      }));
    }
  }, [eventId, userId, state.isLiked]);

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

  const fetchAllLikes = useCallback(async () => {
    if (eventIds.length === 0) {
      setLikesMap(new Map());
      setIsLoading(false);
      return;
    }

    try {
      // Fetch counts for all events
      const { data: allLikes, error } = await supabase
        .from('event_likes')
        .select('event_id, user_id')
        .in('event_id', eventIds);

      if (error) throw error;

      const newMap = new Map<string, { count: number; isLiked: boolean }>();
      
      eventIds.forEach(eventId => {
        const eventLikes = allLikes?.filter(l => l.event_id === eventId) || [];
        const isLiked = userId ? eventLikes.some(l => l.user_id === userId) : false;
        newMap.set(eventId, { count: eventLikes.length, isLiked });
      });

      setLikesMap(newMap);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching likes:', error);
      setIsLoading(false);
    }
  }, [eventIds.join(','), userId]);

  useEffect(() => {
    fetchAllLikes();
  }, [fetchAllLikes]);

  const toggleLike = useCallback(async (eventId: string) => {
    if (!userId) return;

    const current = likesMap.get(eventId) || { count: 0, isLiked: false };
    
    // Optimistic update
    setLikesMap(prev => {
      const newMap = new Map(prev);
      newMap.set(eventId, {
        count: current.isLiked ? current.count - 1 : current.count + 1,
        isLiked: !current.isLiked,
      });
      return newMap;
    });

    try {
      if (current.isLiked) {
        const { error } = await supabase
          .from('event_likes')
          .delete()
          .eq('event_id', eventId)
          .eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('event_likes')
          .insert({ event_id: eventId, user_id: userId });
        if (error) throw error;
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      // Revert
      setLikesMap(prev => {
        const newMap = new Map(prev);
        newMap.set(eventId, current);
        return newMap;
      });
    }
  }, [userId, likesMap]);

  const getLikeState = useCallback((eventId: string) => {
    return likesMap.get(eventId) || { count: 0, isLiked: false };
  }, [likesMap]);

  return {
    getLikeState,
    toggleLike,
    isLoading,
    refetch: fetchAllLikes,
  };
};
