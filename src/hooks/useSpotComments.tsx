import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';
import { useMapRefetch } from './useMapRefetch';
import { getOrCreateChannel, safeRemoveChannel } from '@/lib/realtimeUtils';

export interface SpotComment {
  id: string;
  spot_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export const useSpotComments = (spotId: string | null) => {
  const [comments, setComments] = useState<SpotComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const spotIdRef = useRef(spotId);
  const queryClient = useQueryClient();
  const { triggerEventRefetch } = useMapRefetch();

  useEffect(() => {
    spotIdRef.current = spotId;
  }, [spotId]);

  const fetchComments = useCallback(async () => {
    const currentSpotId = spotIdRef.current;
    if (!currentSpotId) {
      setComments([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('spot_comments')
        .select('*')
        .eq('spot_id', currentSpotId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error('Error fetching spot comments:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchComments();
  }, [spotId, fetchComments]);

  // Realtime subscription - use stable channel name, filter by spotId in handler
  useEffect(() => {
    const channelName = 'spot-comments-global';
    
    // NOTE: spot_comments visibility can depend on auth.uid() (private/access-controlled events).
    // If we subscribe before the Supabase session is loaded, the channel may be authorized as "anon"
    // and won't receive events that require authenticated visibility. To avoid "refresh fixes it",
    // recreate the channel on auth state changes (sign-in / sign-out / token refresh).
    const attachHandlersAndSubscribe = () => {
      const { channel } = getOrCreateChannel(channelName);

      channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'spot_comments',
        },
        (payload) => {
          const newComment = payload.new as SpotComment;
          
          // Filter using ref to always have current spotId
          if (!spotIdRef.current || String(newComment.spot_id) !== String(spotIdRef.current)) {
            return;
          }

          console.log('[useSpotComments] 🔔 Comment INSERT for spot:', spotIdRef.current);
          setComments(prev => {
            if (prev.some(c => c.id === newComment.id)) {
              return prev;
            }
            const filtered = prev.filter(c => !c.id.startsWith('temp-'));
            return [...filtered, newComment].sort((a, b) => 
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'spot_comments',
        },
        (payload) => {
          const deletedComment = payload.old as SpotComment;
          
          if (!spotIdRef.current || String(deletedComment.spot_id) !== String(spotIdRef.current)) {
            return;
          }

          console.log('[useSpotComments] 🔔 Comment DELETE for spot:', spotIdRef.current);
          setComments(prev => prev.filter(c => c.id !== deletedComment.id));
        }
      )
      channel.subscribe((status) => {
        console.log('[useSpotComments] 📡 Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('[useSpotComments] ✅ Subscribed');
        }
      });

      return channel;
    };

    let channel = attachHandlersAndSubscribe();

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        console.log('[useSpotComments] 🔁 Recreating realtime channel due to auth change:', event);
        safeRemoveChannel(channel);
        channel = attachHandlersAndSubscribe();
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
      safeRemoveChannel(channel);
    };
  }, []); // Empty deps - subscribe once, filter in handler

  const addComment = useCallback(async (userId: string, content: string) => {
    const currentSpotId = spotIdRef.current;
    if (!currentSpotId || !content.trim()) return;

    const trimmedContent = content.trim();
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const optimisticComment: SpotComment = {
      id: tempId,
      spot_id: currentSpotId,
      user_id: userId,
      content: trimmedContent,
      created_at: new Date().toISOString(),
    };

    setComments(prev => [...prev, optimisticComment]);

    try {
      const { data, error } = await supabase
        .from('spot_comments')
        .insert({
          spot_id: currentSpotId,
          user_id: userId,
          content: trimmedContent,
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setComments(prev => {
          const filtered = prev.filter(c => c.id !== tempId);
          if (!filtered.some(c => c.id === data.id)) {
            return [...filtered, data as SpotComment].sort((a, b) => 
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
          }
          return filtered;
        });
      }

      // Invalidate queries to trigger map updates
      if (currentSpotId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.spotComments(currentSpotId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.allEvents() });
        triggerEventRefetch();
      }
    } catch (error) {
      console.error('Error adding spot comment:', error);
      setComments(prev => prev.filter(c => c.id !== tempId));
      throw error;
    }
  }, [queryClient, triggerEventRefetch]);

  const deleteComment = useCallback(async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('spot_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      // Invalidate queries to trigger map updates
      const currentSpotId = spotIdRef.current;
      if (currentSpotId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.spotComments(currentSpotId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.allEvents() });
        triggerEventRefetch();
      }
    } catch (error) {
      console.error('Error deleting spot comment:', error);
      throw error;
    }
  }, [queryClient, triggerEventRefetch]);

  return { comments, isLoading, addComment, deleteComment, refetch: fetchComments };
};

export const useSpotCommentLikes = (commentIds: string[], userId: string | null) => {
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
        .from('spot_comment_likes')
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
      console.error('Error fetching spot comment likes:', error);
    }
  }, []);

  useEffect(() => {
    fetchLikes();
  }, [commentIds.join(','), userId, fetchLikes]);

  // Realtime subscription - use stable channel name, filter in handler
  useEffect(() => {
    const channelName = 'spot-comment-likes-global';
    
    // Check if channel already exists to prevent CHANNEL_ERROR
    const { channel, shouldSubscribe } = getOrCreateChannel(channelName);
    
    if (!shouldSubscribe) {
      console.log('[useSpotCommentLikes] Channel already subscribed:', channelName);
      return;
    }
    
    channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'spot_comment_likes',
        },
        (payload) => {
          const newLike = payload.new as { comment_id: string; user_id: string };
          const commentIdStr = String(newLike.comment_id);
          
          if (!commentIdsRef.current.map(String).includes(commentIdStr)) {
            return;
          }

          console.log('[useSpotCommentLikes] 🔔 Like INSERT for comment:', commentIdStr);
          setLikesMap(prev => {
            const current = prev[commentIdStr] || { count: 0, hasLiked: false };
            // Deduplicate optimistic update: avoid double increment for our own like
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
          table: 'spot_comment_likes',
        },
        (payload) => {
          const oldLike = payload.old as { comment_id: string; user_id: string };
          const commentIdStr = String(oldLike.comment_id);
          
          if (!commentIdsRef.current.map(String).includes(commentIdStr)) {
            return;
          }

          console.log('[useSpotCommentLikes] 🔔 Like DELETE for comment:', commentIdStr);
          setLikesMap(prev => {
            const current = prev[commentIdStr] || { count: 0, hasLiked: false };
            // Deduplicate optimistic update: avoid double decrement for our own unlike
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
      console.log('[useSpotCommentLikes] 📡 Subscription status:', status);
      if (status === 'SUBSCRIBED') {
        console.log('[useSpotCommentLikes] ✅ Subscribed');
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
          .from('spot_comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', userIdRef.current);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('spot_comment_likes')
          .insert({ comment_id: commentId, user_id: userIdRef.current });

        if (error) throw error;
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: queryKeys.allSpotComments() });
    } catch (error) {
      console.error('Error toggling spot comment like:', error);
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
