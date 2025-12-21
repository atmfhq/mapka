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
          // If the message is from someone else, increment the count
          if (payload.new.user_id !== currentUserId) {
            console.log('New message from another user, incrementing unread count');
            setUnreadCount(prev => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  // Mark invitation chat as read
  const markInvitationAsRead = useCallback(async (invitationId: string) => {
    if (!currentUserId) return;

    const { error } = await supabase
      .from('invitations')
      .update({ last_read_at: new Date().toISOString() })
      .eq('id', invitationId);

    if (error) {
      console.error('Error marking invitation as read:', error);
      return;
    }

    // Refetch the count
    fetchUnreadCount();
  }, [currentUserId, fetchUnreadCount]);

  // Mark event chat as read (for participants)
  const markEventAsRead = useCallback(async (eventId: string) => {
    if (!currentUserId) return;

    // First try to update event_participants
    const { error: participantError } = await supabase
      .from('event_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('event_id', eventId)
      .eq('user_id', currentUserId);

    if (participantError) {
      console.error('Error marking event as read:', participantError);
    }

    // Refetch the count
    fetchUnreadCount();
  }, [currentUserId, fetchUnreadCount]);

  return {
    unreadCount,
    loading,
    refetch: fetchUnreadCount,
    markInvitationAsRead,
    markEventAsRead,
  };
};
