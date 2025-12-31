import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useShoutLikes = (shoutIds: string[], userId: string | null) => {
  const [likesMap, setLikesMap] = useState<Record<string, { count: number; hasLiked: boolean }>>({});

  const fetchLikes = useCallback(async () => {
    if (shoutIds.length === 0) {
      setLikesMap({});
      return;
    }

    try {
      const { data, error } = await supabase
        .from('shout_likes')
        .select('shout_id, user_id')
        .in('shout_id', shoutIds);

      if (error) throw error;

      const newMap: Record<string, { count: number; hasLiked: boolean }> = {};
      
      shoutIds.forEach(shoutId => {
        const shoutLikes = data?.filter((l: any) => l.shout_id === shoutId) || [];
        newMap[shoutId] = {
          count: shoutLikes.length,
          hasLiked: userId ? shoutLikes.some((l: any) => l.user_id === userId) : false,
        };
      });

      setLikesMap(newMap);
    } catch (error) {
      console.error('Error fetching shout likes:', error);
    }
  }, [shoutIds.join(','), userId]);

  useEffect(() => {
    fetchLikes();
  }, [fetchLikes]);

  // Realtime subscription
  useEffect(() => {
    if (shoutIds.length === 0) return;

    const channel = supabase
      .channel('shout-likes-realtime')
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
            fetchLikes();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [shoutIds.join(','), fetchLikes]);

  const toggleLike = useCallback(async (shoutId: string) => {
    if (!userId) return;

    const current = likesMap[shoutId] || { count: 0, hasLiked: false };
    const hasLiked = current.hasLiked;

    // Optimistic update
    setLikesMap(prev => ({
      ...prev,
      [shoutId]: {
        count: hasLiked ? current.count - 1 : current.count + 1,
        hasLiked: !hasLiked,
      },
    }));

    try {
      if (hasLiked) {
        const { error } = await supabase
          .from('shout_likes')
          .delete()
          .eq('shout_id', shoutId)
          .eq('user_id', userId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('shout_likes')
          .insert({ shout_id: shoutId, user_id: userId });

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error toggling shout like:', error);
      fetchLikes(); // Revert on error
    }
  }, [userId, likesMap, fetchLikes]);

  const getLikes = useCallback((shoutId: string) => {
    return likesMap[shoutId] || { count: 0, hasLiked: false };
  }, [likesMap]);

  return { getLikes, toggleLike, refetch: fetchLikes };
};

export const useShoutCommentLikes = (commentIds: string[], userId: string | null) => {
  const [likesMap, setLikesMap] = useState<Record<string, { count: number; hasLiked: boolean }>>({});

  const fetchLikes = useCallback(async () => {
    if (commentIds.length === 0) {
      setLikesMap({});
      return;
    }

    try {
      const { data, error } = await (supabase
        .from('shout_comment_likes' as any)
        .select('comment_id, user_id')
        .in('comment_id', commentIds) as any);

      if (error) throw error;

      const newMap: Record<string, { count: number; hasLiked: boolean }> = {};
      
      commentIds.forEach(commentId => {
        const commentLikes = data?.filter((l: any) => l.comment_id === commentId) || [];
        newMap[commentId] = {
          count: commentLikes.length,
          hasLiked: userId ? commentLikes.some((l: any) => l.user_id === userId) : false,
        };
      });

      setLikesMap(newMap);
    } catch (error) {
      console.error('Error fetching comment likes:', error);
    }
  }, [commentIds.join(','), userId]);

  useEffect(() => {
    fetchLikes();
  }, [fetchLikes]);

  // Realtime subscription
  useEffect(() => {
    if (commentIds.length === 0) return;

    const channel = supabase
      .channel('shout-comment-likes-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shout_comment_likes',
        },
        (payload) => {
          const commentId = (payload.new as any)?.comment_id || (payload.old as any)?.comment_id;
          if (commentId && commentIds.includes(commentId)) {
            fetchLikes();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [commentIds.join(','), fetchLikes]);

  const toggleLike = useCallback(async (commentId: string) => {
    if (!userId) return;

    const current = likesMap[commentId] || { count: 0, hasLiked: false };
    const hasLiked = current.hasLiked;

    // Optimistic update
    setLikesMap(prev => ({
      ...prev,
      [commentId]: {
        count: hasLiked ? current.count - 1 : current.count + 1,
        hasLiked: !hasLiked,
      },
    }));

    try {
      if (hasLiked) {
        const { error } = await (supabase
          .from('shout_comment_likes' as any)
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', userId) as any);

        if (error) throw error;
      } else {
        const { error } = await (supabase
          .from('shout_comment_likes' as any)
          .insert({ comment_id: commentId, user_id: userId }) as any);

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error toggling comment like:', error);
      fetchLikes(); // Revert on error
    }
  }, [userId, likesMap, fetchLikes]);

  const getLikes = useCallback((commentId: string) => {
    return likesMap[commentId] || { count: 0, hasLiked: false };
  }, [likesMap]);

  return { getLikes, toggleLike, refetch: fetchLikes };
};
