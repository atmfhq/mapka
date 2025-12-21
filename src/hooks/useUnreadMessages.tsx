import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useUnreadMessages = (currentUserId: string | null) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchUnreadCount = useCallback(async () => {
    if (!currentUserId) {
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('get_unread_message_count', {
        p_user_id: currentUserId,
      });

      if (error) {
        console.error('Error fetching unread count:', error);
        setLoading(false);
        return;
      }

      console.log('Unread message count:', data);
      setUnreadCount(data || 0);
    } catch (err) {
      console.error('useUnreadMessages: Unexpected error:', err);
    }

    setLoading(false);
  }, [currentUserId]);

  // Initial fetch
  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Subscribe to new messages in real-time
  // Instead of blindly incrementing, we refetch the accurate count from the database
  // This ensures we only count messages the user should see and hasn't read
  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel('unread-messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'event_chat_messages',
        },
        (payload) => {
          // If the message is from someone else, refetch the accurate count
          // This avoids false positives from messages in chats the user isn't part of
          if (payload.new.user_id !== currentUserId) {
            console.log('New message detected, refetching unread count');
            fetchUnreadCount();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, fetchUnreadCount]);

  // Optimistic: immediately clear unread for a conversation
  const optimisticClearForChat = useCallback((estimatedCount: number = 0) => {
    // If we know the count, subtract it; otherwise assume clearing all for this chat
    if (estimatedCount > 0) {
      setUnreadCount(prev => Math.max(0, prev - estimatedCount));
    }
  }, []);

  // Mark invitation chat as read (fire and forget - background sync)
  const markInvitationAsRead = useCallback((invitationId: string) => {
    if (!currentUserId) return;

    // Fire and forget - don't await
    supabase
      .from('invitations')
      .update({ last_read_at: new Date().toISOString() })
      .eq('id', invitationId)
      .then(({ error }) => {
        if (error) {
          console.error('Error marking invitation as read:', error);
        }
      });
  }, [currentUserId]);

  // Mark event chat as read (fire and forget - background sync)
  const markEventAsRead = useCallback((eventId: string) => {
    if (!currentUserId) return;

    // Fire and forget - don't await
    supabase
      .from('event_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('event_id', eventId)
      .eq('user_id', currentUserId)
      .then(({ error }) => {
        if (error) {
          console.error('Error marking event as read:', error);
        }
      });
  }, [currentUserId]);

  // Silent refetch for data consistency (called when drawer closes)
  const silentRefetch = useCallback(() => {
    if (!currentUserId) return;

    supabase.rpc('get_unread_message_count', {
      p_user_id: currentUserId,
    }).then(({ data, error }) => {
      if (!error && data !== null) {
        setUnreadCount(data);
      }
    });
  }, [currentUserId]);

  return {
    unreadCount,
    loading,
    refetch: fetchUnreadCount,
    silentRefetch,
    optimisticClearForChat,
    markInvitationAsRead,
    markEventAsRead,
  };
};
