import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';
import { useMapRefetch } from './useMapRefetch';
import { getOrCreateChannel, safeRemoveChannel } from '@/lib/realtimeUtils';

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
  const shoutIdRef = useRef(shoutId);
  const queryClient = useQueryClient();
  const { triggerShoutRefetch, triggerCountRefetch } = useMapRefetch();

  // Keep ref in sync
  useEffect(() => {
    shoutIdRef.current = shoutId;
  }, [shoutId]);

  const fetchComments = useCallback(async () => {
    const currentShoutId = shoutIdRef.current;
    if (!currentShoutId) {
      setComments([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('shout_comments')
        .select('*')
        .eq('shout_id', currentShoutId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error('Error fetching shout comments:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchComments();
  }, [shoutId, fetchComments]);

  // Realtime subscription - use stable channel name, filter in handler
  useEffect(() => {
    const channelName = 'shout-comments-global';
    
    // Get or create channel - ALWAYS attach handlers, only subscribe if needed
    const { channel, shouldSubscribe } = getOrCreateChannel(channelName);
    
    console.log('[useShoutComments] Setting up subscription:', channelName);
    
    channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'shout_comments',
        },
        (payload) => {
          const newComment = payload.new as ShoutComment;
          
          // Only process if it's for our shout (using ref to get current value)
          if (!shoutIdRef.current || String(newComment.shout_id) !== String(shoutIdRef.current)) {
            return;
          }

          console.log('[useShoutComments] 🔔 Comment INSERT for shout:', shoutIdRef.current);
          // INSTANT cache injection (chat-style) - update state immediately
          setComments(prev => {
            // Check for duplicates first
            if (prev.some(c => c.id === newComment.id)) {
              console.log('[useShoutComments] Duplicate comment, ignoring');
              return prev;
            }
            // Remove optimistic temp comment if exists
            const filtered = prev.filter(c => !c.id.startsWith('temp-'));
            const updated = [...filtered, newComment].sort((a, b) => 
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
            console.log('[useShoutComments] 💬 Comment list updated, new count:', updated.length);
            return updated;
          });

          // Also update React Query cache if it exists (for consistency)
          const currentShoutId = shoutIdRef.current;
          if (currentShoutId) {
            queryClient.setQueryData<ShoutComment[]>(
              queryKeys.shoutComments(currentShoutId),
              (oldData) => {
                if (!oldData) return [newComment];
                if (oldData.some(c => c.id === newComment.id)) return oldData;
                const filtered = oldData.filter(c => !c.id.startsWith('temp-'));
                return [...filtered, newComment].sort((a, b) => 
                  new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                );
              }
            );
            console.log('[useShoutComments] 📦 React Query cache updated');
          }

          // Background invalidation for consistency (non-blocking)
          setTimeout(() => {
            if (currentShoutId) {
              queryClient.invalidateQueries({ queryKey: queryKeys.shoutComments(currentShoutId) });
            }
          }, 100);
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
          const deletedComment = payload.old as ShoutComment;
          
          // Only process if it's for our shout
          if (!shoutIdRef.current || String(deletedComment.shout_id) !== String(shoutIdRef.current)) {
            return;
          }

          console.log('[useShoutComments] 🔔 Comment DELETE for shout:', shoutIdRef.current);
          setComments(prev => prev.filter(c => c.id !== deletedComment.id));
        }
      );
    
    // Subscribe to the channel
    channel.subscribe((status) => {
      console.log('[useShoutComments] 📡 Subscription status:', status);
      if (status === 'SUBSCRIBED') {
        console.log('[useShoutComments] ✅ Subscribed');
      }
    });

    return () => {
      safeRemoveChannel(channel);
    };
  }, [queryClient]); // Only queryClient as dep (stable)

  const addComment = useCallback(async (userId: string, content: string) => {
    const currentShoutId = shoutIdRef.current;
    if (!currentShoutId || !content.trim()) return;

    const trimmedContent = content.trim();
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const optimisticComment: ShoutComment = {
      id: tempId,
      shout_id: currentShoutId,
      user_id: userId,
      content: trimmedContent,
      created_at: new Date().toISOString(),
    };

    // Optimistic update
    setComments(prev => [...prev, optimisticComment]);

    try {
      const { data, error } = await supabase
        .from('shout_comments')
        .insert({
          shout_id: currentShoutId,
          user_id: userId,
          content: trimmedContent,
        })
        .select()
        .single();

      if (error) throw error;

      // Replace optimistic comment with real one
      if (data) {
        setComments(prev => {
          const filtered = prev.filter(c => c.id !== tempId);
          // Real comment will arrive via realtime, but add it here too for immediate update
          if (!filtered.some(c => c.id === data.id)) {
            return [...filtered, data as ShoutComment].sort((a, b) => 
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
          }
          return filtered;
        });
      }

      // Invalidate queries to trigger map updates
      if (currentShoutId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.shoutComments(currentShoutId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.allShoutCounts() });
        queryClient.invalidateQueries({ queryKey: queryKeys.allShouts() });
        triggerShoutRefetch();
        triggerCountRefetch();
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      // Revert optimistic update
      setComments(prev => prev.filter(c => c.id !== tempId));
      throw error;
    }
  }, []);

  const deleteComment = useCallback(async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('shout_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      // Invalidate queries to trigger map updates
      const currentShoutId = shoutIdRef.current;
      if (currentShoutId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.shoutComments(currentShoutId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.allShoutCounts() });
        queryClient.invalidateQueries({ queryKey: queryKeys.allShouts() });
        triggerShoutRefetch();
        triggerCountRefetch();
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
      throw error;
    }
  }, [queryClient, triggerShoutRefetch, triggerCountRefetch]);

  return { comments, isLoading, addComment, deleteComment, refetch: fetchComments };
};
