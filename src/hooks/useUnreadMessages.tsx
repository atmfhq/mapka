import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getOrCreateChannel, safeRemoveChannel } from '@/lib/realtimeUtils';

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
      const { data, error } = await supabase.rpc('get_global_unread_count', {
        p_user_id: currentUserId,
      });

      if (error) {
        console.error('Error fetching global unread count:', error);
        setLoading(false);
        return;
      }

      console.log('[Global Unread] Unread message count (event + DM):', data);
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

  // Use ref to avoid re-subscribing when fetchUnreadCount changes
  const fetchUnreadCountRef = useRef(fetchUnreadCount);
  useEffect(() => {
    fetchUnreadCountRef.current = fetchUnreadCount;
  }, [fetchUnreadCount]);

  // Subscribe to new messages in real-time (GLOBAL subscription - no filters)
  // Listens to both event_chat_messages and direct_messages
  // Filter events client-side to avoid RLS issues
  // Instead of blindly incrementing, we refetch the accurate count from the database
  // This ensures we only count messages the user should see and hasn't read
  useEffect(() => {
    if (!currentUserId) return;

    // Use stable channel name (with userId for uniqueness, no Date.now())
    const channelName = `global-unread-messages-${currentUserId}`;
    
    // Check if channel already exists to prevent CHANNEL_ERROR
    const { channel, shouldSubscribe } = getOrCreateChannel(channelName);
    
    if (!shouldSubscribe) {
      console.log('[Global Unread] Channel already subscribed:', channelName);
      return;
    }
    
    console.log('[Global Unread] Setting up GLOBAL realtime subscription:', channelName);
    
    channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'event_chat_messages',
          // NO FILTER - listen globally, filter in handler
        },
        (payload) => {
          // CLIENT-SIDE FILTERING: Only process if message is from someone else
          // This avoids false positives from messages in chats the user isn't part of
          if (payload.new.user_id !== currentUserId) {
            console.log('[Global Unread] New event message detected, refetching unread count');
            fetchUnreadCountRef.current();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          // NO FILTER - listen globally, filter in handler
        },
        (payload) => {
          // CLIENT-SIDE FILTERING: Only process if message is from someone else (received message)
          if (payload.new.sender_id !== currentUserId) {
            console.log('[Global Unread] New direct message detected, refetching unread count');
            fetchUnreadCountRef.current();
          }
        }
      )
    channel.subscribe((status) => {
      console.log('[Global Unread] Subscription status:', status);
      if (status === 'SUBSCRIBED') {
        console.log('[Global Unread] ✅ Successfully subscribed to realtime');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[Global Unread] ❌ Channel error - subscription failed');
      }
    });

    return () => {
      console.log('[Global Unread] Cleaning up subscription:', channelName);
      safeRemoveChannel(channel);
    };
  }, [currentUserId]);

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
      })
      .catch((err) => console.error('Unhandled error marking invitation as read:', err));
  }, [currentUserId]);

  // Mark event chat as read (fire and forget - background sync)
  // Uses upsert to handle hosts who may not have a participant record
  const markEventAsRead = useCallback((eventId: string) => {
    if (!currentUserId) return;

    // Fire and forget - don't await
    supabase
      .from('event_participants')
      .upsert(
        {
          event_id: eventId,
          user_id: currentUserId,
          status: 'joined',
          last_read_at: new Date().toISOString(),
        },
        {
          onConflict: 'event_id,user_id',
        }
      )
      .then(({ error }) => {
        if (error) {
          console.error('Error marking event as read:', error);
        }
      })
      .catch((err) => console.error('Unhandled error marking event as read:', err));
  }, [currentUserId]);

  // Silent refetch for data consistency (called when drawer closes)
  const silentRefetch = useCallback(() => {
    if (!currentUserId) return;

    supabase.rpc('get_global_unread_count', {
      p_user_id: currentUserId,
    }).then(({ data, error }) => {
      if (!error && data !== null) {
        setUnreadCount(data);
      }
    }).catch((err) => console.error('Unhandled error in silentRefetch:', err));
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
