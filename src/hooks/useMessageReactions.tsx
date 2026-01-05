import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getOrCreateChannel, safeRemoveChannel } from '@/lib/realtimeUtils';

export const REACTION_EMOJIS = ['❤️', '👍', '😂'] as const;
export type ReactionEmoji = typeof REACTION_EMOJIS[number];

interface Reaction {
  emoji: string;
  count: number;
  hasReacted: boolean;
}

interface ReactionsMap {
  [messageId: string]: Reaction[];
}

export const useMessageReactions = (messageIds: string[], userId: string | null) => {
  const [reactionsMap, setReactionsMap] = useState<ReactionsMap>({});
  const [isLoading, setIsLoading] = useState(true);
  
  // Use refs to avoid stale closure issues
  const messageIdsRef = useRef<string[]>(messageIds);
  messageIdsRef.current = messageIds;
  
  const reactionsMapRef = useRef<ReactionsMap>({});
  reactionsMapRef.current = reactionsMap;

  const fetchReactions = useCallback(async () => {
    if (messageIds.length === 0) {
      setReactionsMap({});
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('message_reactions')
        .select('message_id, user_id, emoji')
        .in('message_id', messageIds);

      if (error) throw error;

      // Build reactions map
      const newMap: ReactionsMap = {};
      
      messageIds.forEach(msgId => {
        const msgReactions = data?.filter(r => r.message_id === msgId) || [];
        
        // Group by emoji
        const emojiCounts = new Map<string, { count: number; hasReacted: boolean }>();
        
        msgReactions.forEach(r => {
          const existing = emojiCounts.get(r.emoji) || { count: 0, hasReacted: false };
          existing.count++;
          if (userId && r.user_id === userId) {
            existing.hasReacted = true;
          }
          emojiCounts.set(r.emoji, existing);
        });

        newMap[msgId] = Array.from(emojiCounts.entries()).map(([emoji, data]) => ({
          emoji,
          count: data.count,
          hasReacted: data.hasReacted,
        }));
      });

      setReactionsMap(newMap);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching reactions:', error);
      setIsLoading(false);
    }
  }, [messageIds.join(','), userId]);

  useEffect(() => {
    fetchReactions();
  }, [fetchReactions]);

  // Subscribe to realtime updates for reactions - use stable channel name
  useEffect(() => {
    const channelName = 'message-reactions-global';
    
    // Check if channel already exists to prevent CHANNEL_ERROR
    const { channel, shouldSubscribe } = getOrCreateChannel(channelName);
    
    if (!shouldSubscribe) {
      console.log('[useMessageReactions] Channel already subscribed:', channelName);
      return;
    }
    
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'message_reactions',
      },
      (payload) => {
        const msgId = (payload.new as any)?.message_id || (payload.old as any)?.message_id;
        // Use ref to get current messageIds
        if (msgId && messageIdsRef.current.includes(msgId)) {
          console.log('[useMessageReactions] 🔔 Reaction change for message:', msgId);
          fetchReactions();
        }
      }
    );
    
    channel.subscribe((status) => {
      console.log('[useMessageReactions] 📡 Subscription status:', status);
      if (status === 'SUBSCRIBED') {
        console.log('[useMessageReactions] ✅ Subscribed');
      }
    });

    return () => {
      safeRemoveChannel(channel);
    };
  }, [fetchReactions]); // Only fetchReactions as dep (stable callback)

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!userId) return;

    // Use ref to avoid stale closure
    const currentReactions = reactionsMapRef.current[messageId] || [];
    const existingReaction = currentReactions.find(r => r.emoji === emoji);
    const hasReacted = existingReaction?.hasReacted || false;

    // Optimistic update
    setReactionsMap(prev => {
      const newMap = { ...prev };
      const msgReactions = [...(newMap[messageId] || [])];
      
      const idx = msgReactions.findIndex(r => r.emoji === emoji);
      
      if (hasReacted) {
        // Removing reaction
        if (idx >= 0) {
          if (msgReactions[idx].count === 1) {
            msgReactions.splice(idx, 1);
          } else {
            msgReactions[idx] = {
              ...msgReactions[idx],
              count: msgReactions[idx].count - 1,
              hasReacted: false,
            };
          }
        }
      } else {
        // Adding reaction
        if (idx >= 0) {
          msgReactions[idx] = {
            ...msgReactions[idx],
            count: msgReactions[idx].count + 1,
            hasReacted: true,
          };
        } else {
          msgReactions.push({ emoji, count: 1, hasReacted: true });
        }
      }
      
      newMap[messageId] = msgReactions;
      return newMap;
    });

    try {
      if (hasReacted) {
        // Remove reaction
        const { error } = await supabase
          .from('message_reactions')
          .delete()
          .eq('message_id', messageId)
          .eq('user_id', userId)
          .eq('emoji', emoji);

        if (error) throw error;
      } else {
        // Add reaction
        const { error } = await supabase
          .from('message_reactions')
          .insert({ message_id: messageId, user_id: userId, emoji });

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error toggling reaction:', error);
      // Revert on error
      fetchReactions();
    }
  }, [userId, fetchReactions]); // Use ref for reactionsMap to avoid stale closure

  const getReactions = useCallback((messageId: string): Reaction[] => {
    return reactionsMap[messageId] || [];
  }, [reactionsMap]);

  return {
    getReactions,
    toggleReaction,
    isLoading,
    refetch: fetchReactions,
  };
};
