import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

  const fetchComments = useCallback(async () => {
    if (!spotId) {
      setComments([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await (supabase
        .from('spot_comments' as any)
        .select('*')
        .eq('spot_id', spotId)
        .order('created_at', { ascending: true }) as any);

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error('Error fetching spot comments:', error);
    } finally {
      setIsLoading(false);
    }
  }, [spotId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Realtime subscription
  useEffect(() => {
    if (!spotId) return;

    const channel = supabase
      .channel(`spot-comments-${spotId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'spot_comments',
          filter: `spot_id=eq.${spotId}`,
        },
        (payload) => {
          const newComment = payload.new as SpotComment;
          setComments(prev => [...prev, newComment]);
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
          const deletedId = payload.old?.id;
          if (deletedId) {
            setComments(prev => prev.filter(c => c.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [spotId]);

  const addComment = useCallback(async (userId: string, content: string) => {
    if (!spotId || !content.trim()) return;

    try {
      const { error } = await (supabase
        .from('spot_comments' as any)
        .insert({
          spot_id: spotId,
          user_id: userId,
          content: content.trim(),
        }) as any);

      if (error) throw error;
    } catch (error) {
      console.error('Error adding spot comment:', error);
      throw error;
    }
  }, [spotId]);

  const deleteComment = useCallback(async (commentId: string) => {
    try {
      const { error } = await (supabase
        .from('spot_comments' as any)
        .delete()
        .eq('id', commentId) as any);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting spot comment:', error);
      throw error;
    }
  }, []);

  return { comments, isLoading, addComment, deleteComment, refetch: fetchComments };
};

export const useSpotCommentLikes = (commentIds: string[], userId: string | null) => {
  const [likesMap, setLikesMap] = useState<Record<string, { count: number; hasLiked: boolean }>>({});

  const fetchLikes = useCallback(async () => {
    if (commentIds.length === 0) {
      setLikesMap({});
      return;
    }

    try {
      const { data, error } = await (supabase
        .from('spot_comment_likes' as any)
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
      console.error('Error fetching spot comment likes:', error);
    }
  }, [commentIds.join(','), userId]);

  useEffect(() => {
    fetchLikes();
  }, [fetchLikes]);

  // Realtime subscription
  useEffect(() => {
    if (commentIds.length === 0) return;

    const channel = supabase
      .channel('spot-comment-likes-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'spot_comment_likes',
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
          .from('spot_comment_likes' as any)
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', userId) as any);

        if (error) throw error;
      } else {
        const { error } = await (supabase
          .from('spot_comment_likes' as any)
          .insert({ comment_id: commentId, user_id: userId }) as any);

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error toggling spot comment like:', error);
      fetchLikes(); // Revert on error
    }
  }, [userId, likesMap, fetchLikes]);

  const getLikes = useCallback((commentId: string) => {
    return likesMap[commentId] || { count: 0, hasLiked: false };
  }, [likesMap]);

  return { getLikes, toggleLike, refetch: fetchLikes };
};
