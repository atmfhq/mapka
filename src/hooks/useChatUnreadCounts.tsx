import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UnreadCounts {
  [eventId: string]: number;
}

export const useChatUnreadCounts = (currentUserId: string | null, eventIds: string[]) => {
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({});
  const [loading, setLoading] = useState(true);

  const fetchUnreadCounts = useCallback(async () => {
    if (!currentUserId || eventIds.length === 0) {
      setUnreadCounts({});
      setLoading(false);
      return;
    }

    try {
      // Get user's last_read_at for each event they participate in (includes hosts via upsert)
      const { data: participations } = await supabase
        .from('event_participants')
        .select('event_id, last_read_at')
        .eq('user_id', currentUserId)
        .in('event_id', eventIds);

      // Build a map of event_id -> last_read_at
      const lastReadMap: { [eventId: string]: string } = {};
      
      for (const p of participations || []) {
        lastReadMap[p.event_id] = p.last_read_at || '1970-01-01T00:00:00Z';
      }

      // Now count unread messages for each event
      const counts: UnreadCounts = {};
      
      for (const eventId of eventIds) {
        const lastReadAt = lastReadMap[eventId];
        
        // If no participation record, they haven't read any messages yet
        // Use a very old date to count all messages
        const cutoffTime = lastReadAt || '1970-01-01T00:00:00Z';
        
        const { count, error } = await supabase
          .from('event_chat_messages')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', eventId)
          .neq('user_id', currentUserId)
          .gt('created_at', cutoffTime);

        if (!error && count !== null) {
          counts[eventId] = count;
        }
      }

      setUnreadCounts(counts);
    } catch (err) {
      console.error('useChatUnreadCounts: Error fetching counts:', err);
    }

    setLoading(false);
  }, [currentUserId, eventIds.join(',')]);

  useEffect(() => {
    fetchUnreadCounts();
  }, [fetchUnreadCounts]);

  // Subscribe to new messages for these events
  useEffect(() => {
    if (!currentUserId || eventIds.length === 0) return;

    const channel = supabase
      .channel('chat-unread-counts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'event_chat_messages',
        },
        (payload) => {
          // If message is in one of our events and from someone else, refetch
          if (
            eventIds.includes(payload.new.event_id) &&
            payload.new.user_id !== currentUserId
          ) {
            fetchUnreadCounts();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, eventIds.join(','), fetchUnreadCounts]);

  const getUnreadCount = (eventId: string): number => {
    return unreadCounts[eventId] || 0;
  };

  return {
    unreadCounts,
    getUnreadCount,
    loading,
    refetch: fetchUnreadCounts,
  };
};
