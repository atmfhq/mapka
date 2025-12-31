import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ShoutComment {
  id: string;
  shout_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export const useShoutComments = (shoutId: string | null) => {
  const [comments, setComments] = useState<ShoutComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchComments = useCallback(async () => {
    if (!shoutId) {
      setComments([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await (supabase
        .from('shout_comments' as any)
        .select('*')
        .eq('shout_id', shoutId)
        .order('created_at', { ascending: true }) as any);

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error('Error fetching shout comments:', error);
    } finally {
      setIsLoading(false);
    }
  }, [shoutId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Realtime subscription
  useEffect(() => {
    if (!shoutId) return;

    const channel = supabase
      .channel(`shout-comments-${shoutId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'shout_comments',
          filter: `shout_id=eq.${shoutId}`,
        },
        (payload) => {
          const newComment = payload.new as ShoutComment;
          setComments(prev => [...prev, newComment]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'shout_comments',
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
  }, [shoutId]);

  const addComment = useCallback(async (userId: string, content: string) => {
    if (!shoutId || !content.trim()) return;

    try {
      const { error } = await (supabase
        .from('shout_comments' as any)
        .insert({
          shout_id: shoutId,
          user_id: userId,
          content: content.trim(),
        }) as any);

      if (error) throw error;
    } catch (error) {
      console.error('Error adding comment:', error);
      throw error;
    }
  }, [shoutId]);

  const deleteComment = useCallback(async (commentId: string) => {
    try {
      const { error } = await (supabase
        .from('shout_comments' as any)
        .delete()
        .eq('id', commentId) as any);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting comment:', error);
      throw error;
    }
  }, []);

  return { comments, isLoading, addComment, deleteComment, refetch: fetchComments };
};
