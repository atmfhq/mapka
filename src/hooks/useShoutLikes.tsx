import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';
import { useMapRefetch } from './useMapRefetch';
import { getOrCreateChannel, safeRemoveChannel } from '@/lib/realtimeUtils';

export const useShoutLikes = (shoutIds: string[], userId: string | null) => {
  const [likesMap, setLikesMap] = useState<Record<string, { count: number; hasLiked: boolean }>>({});
  const shoutIdsRef = useRef(shoutIds);
  const userIdRef = useRef(userId);
  const queryClient = useQueryClient();
  const { triggerShoutRefetch, triggerCountRefetch } = useMapRefetch();
  const fetchLikesRef = useRef<() => void>(() => {});

  // Keep refs in sync
  useEffect(() => {
    shoutIdsRef.current = shoutIds;
  }, [shoutIds.join(',')]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  const fetchLikes = useCallback(async () => {
    const currentShoutIds = shoutIdsRef.current;
    if (currentShoutIds.length === 0) {
      setLikesMap({});
      return;
    }

    try {
      const { data, error } = await supabase
        .from('shout_likes')
        .select('shout_id, user_id')
        .in('shout_id', currentShoutIds);

      if (error) throw error;

      const newMap: Record<string, { count: number; hasLiked: boolean }> = {};
      
      currentShoutIds.forEach(shoutId => {
        const shoutLikes = data?.filter((l: any) => String(l.shout_id) === String(shoutId)) || [];
        newMap[String(shoutId)] = {
          count: shoutLikes.length,
          hasLiked: userIdRef.current ? shoutLikes.some((l: any) => l.user_id === userIdRef.current) : false,
        };
      });

      setLikesMap(newMap);
    } catch (error) {
      console.error('Error fetching shout likes:', error);
    }
  }, []);

  useEffect(() => {
    fetchLikesRef.current = () => {
      fetchLikes();
    };
  }, [fetchLikes]);

  useEffect(() => {
    fetchLikes();
  }, [shoutIds.join(','), userId, fetchLikes]);

  // Realtime subscription - use stable channel name, filter in handler using refs
  useEffect(() => {
    const channelName = 'shout-likes-global';
    
    // Get or create channel - ALWAYS attach handlers, only subscribe if needed
    const { channel, shouldSubscribe } = getOrCreateChannel(channelName);
    
    console.log('[useShoutLikes] Setting up subscription:', channelName);
    
    channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'shout_likes',
        },
        (payload) => {
          const newLike = payload.new as { shout_id: string; user_id: string };
          const shoutIdStr = String(newLike.shout_id);
          
          // Only process if it's for one of our tracked shouts
          if (!shoutIdsRef.current.map(String).includes(shoutIdStr)) {
            return;
          }

          console.log('[useShoutLikes] 🔔 Like INSERT for shout:', shoutIdStr);
          setLikesMap(prev => {
            const current = prev[shoutIdStr] || { count: 0, hasLiked: false };
            // Deduplicate optimistic update: avoid double increment for our own like
            if (userIdRef.current && newLike.user_id === userIdRef.current && current.hasLiked) {
              return prev;
            }
            return {
              ...prev,
              [shoutIdStr]: {
                count: current.count + 1,
                hasLiked: userIdRef.current === newLike.user_id ? true : current.hasLiked,
              },
            };
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'shout_likes',
        },
        (payload) => {
          const oldLike = payload.old as { shout_id: string; user_id: string };
          // Some Realtime DELETE payloads omit non-PK columns unless REPLICA IDENTITY FULL is enabled.
          // If we can't identify which shout changed, fall back to a full refetch.
          if (!oldLike?.shout_id) {
            console.warn('[useShoutLikes] Like DELETE received without shout_id; falling back to refetch');
            fetchLikesRef.current();
            // Also trigger count refetch for map
            triggerCountRefetch();
            return;
          }

          const shoutIdStr = String(oldLike.shout_id);
          
          // Only process if it's for one of our tracked shouts
          if (!shoutIdsRef.current.map(String).includes(shoutIdStr)) {
            return;
          }

          console.log('[useShoutLikes] 🔔 Like DELETE for shout:', shoutIdStr);
          setLikesMap(prev => {
            const current = prev[shoutIdStr] || { count: 0, hasLiked: false };
            // Deduplicate optimistic update: avoid double decrement for our own unlike
            if (userIdRef.current && oldLike.user_id === userIdRef.current && !current.hasLiked) {
              return prev;
            }
            return {
              ...prev,
              [shoutIdStr]: {
                count: Math.max(0, current.count - 1),
                hasLiked: userIdRef.current === oldLike.user_id ? false : current.hasLiked,
              },
            };
          });
        }
      );
    
    // Subscribe to the channel
    channel.subscribe((status) => {
      console.log('[useShoutLikes] 📡 Subscription status:', status);
      if (status === 'SUBSCRIBED') {
        console.log('[useShoutLikes] ✅ Subscribed');
      }
    });

    return () => {
      safeRemoveChannel(channel);
    };
  }, []); // Empty deps - subscribe once, filter in handler

  const toggleLike = useCallback(async (shoutId: string) => {
    if (!userIdRef.current) return;

    const shoutIdStr = String(shoutId);
    let previousState: { count: number; hasLiked: boolean } | null = null;
    
    // Optimistic update
    setLikesMap(prev => {
      const current = prev[shoutIdStr] || { count: 0, hasLiked: false };
      previousState = current;
      return {
        ...prev,
        [shoutIdStr]: {
          count: current.hasLiked ? current.count - 1 : current.count + 1,
          hasLiked: !current.hasLiked,
        },
      };
    });

    try {
      if (previousState?.hasLiked) {
        const { error } = await supabase
          .from('shout_likes')
          .delete()
          .eq('shout_id', shoutId)
          .eq('user_id', userIdRef.current);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('shout_likes')
          .insert({ shout_id: shoutId, user_id: userIdRef.current });

        if (error) throw error;
      }

      // Invalidate queries to trigger map updates
      queryClient.invalidateQueries({ queryKey: queryKeys.allShoutCounts() });
      queryClient.invalidateQueries({ queryKey: queryKeys.allShouts() });
      triggerShoutRefetch();
      triggerCountRefetch();
    } catch (error) {
      console.error('Error toggling shout like:', error);
      // Revert on error
      if (previousState) {
        setLikesMap(prev => ({
          ...prev,
          [shoutIdStr]: previousState!,
        }));
      } else {
        fetchLikes();
      }
    }
  }, [fetchLikes, queryClient, triggerShoutRefetch, triggerCountRefetch]);

  const getLikes = useCallback((shoutId: string) => {
    return likesMap[String(shoutId)] || { count: 0, hasLiked: false };
  }, [likesMap]);

  return { getLikes, toggleLike, refetch: fetchLikes };
};

export const useShoutCommentLikes = (commentIds: string[], userId: string | null) => {
  const [likesMap, setLikesMap] = useState<Record<string, { count: number; hasLiked: boolean }>>({});
  const commentIdsRef = useRef(commentIds);
  const userIdRef = useRef(userId);
  const queryClient = useQueryClient();

  useEffect(() => {
    commentIdsRef.current = commentIds;
  }, [commentIds.join(',')]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  const fetchLikes = useCallback(async () => {
    const currentCommentIds = commentIdsRef.current;
    if (currentCommentIds.length === 0) {
      setLikesMap({});
      return;
    }

    // Filter out temp IDs (optimistic comments that haven't been saved yet)
    const validCommentIds = currentCommentIds.filter(id => !id.startsWith('temp-'));

    if (validCommentIds.length === 0) {
      setLikesMap({});
      return;
    }

    try {
      const { data, error } = await supabase
        .from('shout_comment_likes')
        .select('comment_id, user_id')
        .in('comment_id', validCommentIds);

      if (error) throw error;

      const newMap: Record<string, { count: number; hasLiked: boolean }> = {};
      
      // Initialize map for all comment IDs (including temp ones with default values)
      currentCommentIds.forEach(commentId => {
        if (commentId.startsWith('temp-')) {
          // Temp comments have no likes yet
          newMap[String(commentId)] = {
            count: 0,
            hasLiked: false,
          };
        } else {
          const commentLikes = data?.filter((l: any) => String(l.comment_id) === String(commentId)) || [];
          newMap[String(commentId)] = {
            count: commentLikes.length,
            hasLiked: userIdRef.current ? commentLikes.some((l: any) => l.user_id === userIdRef.current) : false,
          };
        }
      });

      setLikesMap(newMap);
    } catch (error) {
      console.error('Error fetching comment likes:', error);
    }
  }, []);

  useEffect(() => {
    fetchLikes();
  }, [commentIds.join(','), userId, fetchLikes]);

  // Realtime subscription - use stable channel name, filter in handler
  useEffect(() => {
    const channelName = 'shout-comment-likes-global';
    
    // Check if channel already exists to prevent CHANNEL_ERROR
    const { channel, shouldSubscribe } = getOrCreateChannel(channelName);
    
    if (!shouldSubscribe) {
      console.log('[useShoutCommentLikes] Channel already subscribed:', channelName);
      return;
    }
    
    channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'shout_comment_likes',
        },
        (payload) => {
          const newLike = payload.new as { comment_id: string; user_id: string };
          const commentIdStr = String(newLike.comment_id);
          
          if (!commentIdsRef.current.map(String).includes(commentIdStr)) {
            return;
          }

          console.log('[useShoutCommentLikes] 🔔 Like INSERT for comment:', commentIdStr);
          setLikesMap(prev => {
            const current = prev[commentIdStr] || { count: 0, hasLiked: false };
            // Deduplicate: if THIS client already applied an optimistic "like",
            // the realtime INSERT for our own user would otherwise double-increment.
            if (userIdRef.current && newLike.user_id === userIdRef.current && current.hasLiked) {
              return prev;
            }
            return {
              ...prev,
              [commentIdStr]: {
                count: current.count + 1,
                hasLiked: userIdRef.current === newLike.user_id ? true : current.hasLiked,
              },
            };
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'shout_comment_likes',
        },
        (payload) => {
          const oldLike = payload.old as { comment_id: string; user_id: string };
          const commentIdStr = String(oldLike.comment_id);
          
          if (!commentIdsRef.current.map(String).includes(commentIdStr)) {
            return;
          }

          console.log('[useShoutCommentLikes] 🔔 Like DELETE for comment:', commentIdStr);
          setLikesMap(prev => {
            const current = prev[commentIdStr] || { count: 0, hasLiked: false };
            // Deduplicate: if THIS client already applied an optimistic "unlike",
            // the realtime DELETE for our own user would otherwise double-decrement.
            if (userIdRef.current && oldLike.user_id === userIdRef.current && !current.hasLiked) {
              return prev;
            }
            return {
              ...prev,
              [commentIdStr]: {
                count: Math.max(0, current.count - 1),
                hasLiked: userIdRef.current === oldLike.user_id ? false : current.hasLiked,
              },
            };
          });
        }
      )
    channel.subscribe((status) => {
      console.log('[useShoutCommentLikes] 📡 Subscription status:', status);
      if (status === 'SUBSCRIBED') {
        console.log('[useShoutCommentLikes] ✅ Subscribed');
      }
    });

    return () => {
      safeRemoveChannel(channel);
    };
  }, []); // Empty deps - subscribe once, filter in handler

  const toggleLike = useCallback(async (commentId: string) => {
    if (!userIdRef.current) return;

    const commentIdStr = String(commentId);
    let previousState: { count: number; hasLiked: boolean } | null = null;
    
    setLikesMap(prev => {
      const current = prev[commentIdStr] || { count: 0, hasLiked: false };
      previousState = current;
      return {
        ...prev,
        [commentIdStr]: {
          count: current.hasLiked ? current.count - 1 : current.count + 1,
          hasLiked: !current.hasLiked,
        },
      };
    });

    try {
      if (previousState?.hasLiked) {
        const { error } = await supabase
          .from('shout_comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', userIdRef.current);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('shout_comment_likes')
          .insert({ comment_id: commentId, user_id: userIdRef.current });

        if (error) throw error;
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: queryKeys.allShoutComments() });
    } catch (error) {
      console.error('Error toggling comment like:', error);
      if (previousState) {
        setLikesMap(prev => ({
          ...prev,
          [commentIdStr]: previousState!,
        }));
      } else {
        fetchLikes();
      }
    }
  }, [fetchLikes, queryClient]);

  const getLikes = useCallback((commentId: string) => {
    return likesMap[String(commentId)] || { count: 0, hasLiked: false };
  }, [likesMap]);

  return { getLikes, toggleLike, refetch: fetchLikes };
};
