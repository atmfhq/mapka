import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Simple binary state - just track IF there are unread messages, not how many
interface UnreadState {
  [id: string]: boolean;
}

export const useChatUnreadCounts = (
  currentUserId: string | null, 
  eventIds: string[],
  mutedEventIds: Set<string> = new Set(),
  mutedInvitationIds: Set<string> = new Set()
) => {
  const [hasUnreadEvents, setHasUnreadEvents] = useState<UnreadState>({});
  const [hasUnreadDms, setHasUnreadDms] = useState<UnreadState>({});
  const [loading, setLoading] = useState(true);
  
  const eventIdsRef = useRef<string[]>(eventIds);
  const mutedEventIdsRef = useRef<Set<string>>(mutedEventIds);
  const mutedInvitationIdsRef = useRef<Set<string>>(mutedInvitationIds);
  
  // Track currently active/open chats - messages here don't trigger red dot
  const activeEventChatRef = useRef<string | null>(null);
  const activeDmChatRef = useRef<string | null>(null);

  // Keep refs in sync
  useEffect(() => {
    eventIdsRef.current = eventIds;
  }, [eventIds]);
  
  useEffect(() => {
    mutedEventIdsRef.current = mutedEventIds;
  }, [mutedEventIds]);
  
  useEffect(() => {
    mutedInvitationIdsRef.current = mutedInvitationIds;
  }, [mutedInvitationIds]);
  
  // Set/clear active chats
  const setActiveEventChat = useCallback((eventId: string | null) => {
    activeEventChatRef.current = eventId;
  }, []);
  
  const setActiveDmChat = useCallback((invitationId: string | null) => {
    activeDmChatRef.current = invitationId;
  }, []);

  // Lightweight initial check - just check IF there are any unread, not count them
  const fetchInitialState = useCallback(async () => {
    if (!currentUserId) {
      setHasUnreadEvents({});
      setHasUnreadDms({});
      setLoading(false);
      return;
    }

    try {
      // Check event chats for any unread
      if (eventIds.length > 0) {
        const { data: participations } = await supabase
          .from('event_participants')
          .select('event_id, last_read_at')
          .eq('user_id', currentUserId)
          .in('event_id', eventIds);

        const { data: hostedEvents } = await supabase
          .from('megaphones')
          .select('id, created_at')
          .eq('host_id', currentUserId)
          .in('id', eventIds);

        const lastReadMap: { [eventId: string]: string } = {};
        for (const p of participations || []) {
          lastReadMap[p.event_id] = p.last_read_at || '1970-01-01T00:00:00Z';
        }
        for (const h of hostedEvents || []) {
          if (!lastReadMap[h.id]) {
            lastReadMap[h.id] = h.created_at || '1970-01-01T00:00:00Z';
          }
        }

        // Check each event for ANY unread message (limit 1 for speed)
        const unreadState: UnreadState = {};
        for (const eventId of eventIds) {
          const cutoffTime = lastReadMap[eventId] || '1970-01-01T00:00:00Z';
          const { count } = await supabase
            .from('event_chat_messages')
            .select('id', { count: 'exact', head: true })
            .eq('event_id', eventId)
            .neq('user_id', currentUserId)
            .gt('created_at', cutoffTime)
            .limit(1);

          unreadState[eventId] = (count || 0) > 0;
        }
        setHasUnreadEvents(unreadState);
      }

      // Check DMs for any unread
      const { data: invitations } = await supabase
        .from('invitations')
        .select('id, last_read_at')
        .eq('status', 'accepted')
        .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`);

      if (invitations && invitations.length > 0) {
        const dmState: UnreadState = {};
        for (const inv of invitations) {
          const cutoffTime = inv.last_read_at || '1970-01-01T00:00:00Z';
          const { count } = await supabase
            .from('direct_messages')
            .select('id', { count: 'exact', head: true })
            .eq('invitation_id', inv.id)
            .neq('sender_id', currentUserId)
            .gt('created_at', cutoffTime)
            .limit(1);

          if ((count || 0) > 0) {
            dmState[inv.id] = true;
          }
        }
        setHasUnreadDms(dmState);
      }
    } catch (err) {
      console.error('useChatUnreadCounts: Error:', err);
    }

    setLoading(false);
  }, [currentUserId, eventIds.join(',')]);

  useEffect(() => {
    fetchInitialState();
  }, [fetchInitialState]);

  // Real-time: new event message -> instant red dot
  useEffect(() => {
    if (!currentUserId) return;

    const channelName = `unread-events-${currentUserId}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'event_chat_messages',
        },
        (payload) => {
          console.log('[Realtime] New event message:', payload.new);
          if (payload.new.user_id !== currentUserId) {
            const eventId = payload.new.event_id;
            // Only show red dot if: we track this event, it's not currently open, not muted
            if (
              eventIdsRef.current.includes(eventId) && 
              activeEventChatRef.current !== eventId &&
              !mutedEventIdsRef.current.has(eventId)
            ) {
              console.log('[Realtime] Setting unread for event:', eventId);
              setHasUnreadEvents(prev => ({ ...prev, [eventId]: true }));
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Event messages channel status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  // Real-time: new DM -> instant red dot
  useEffect(() => {
    if (!currentUserId) return;

    const channelName = `unread-dms-${currentUserId}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
        },
        (payload) => {
          console.log('[Realtime] New DM:', payload.new);
          if (payload.new.sender_id !== currentUserId) {
            const invitationId = payload.new.invitation_id;
            // Only show red dot if: not currently viewing this chat, not muted
            if (
              activeDmChatRef.current !== invitationId &&
              !mutedInvitationIdsRef.current.has(invitationId)
            ) {
              console.log('[Realtime] Setting unread for DM:', invitationId);
              setHasUnreadDms(prev => ({ ...prev, [invitationId]: true }));
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] DM channel status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  // Listen for new accepted invitations to add them to tracking
  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel(`unread-invitations-binary-${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'invitations',
        },
        (payload) => {
          const newInv = payload.new as { sender_id: string; receiver_id: string; status: string };
          if ((newInv.sender_id === currentUserId || newInv.receiver_id === currentUserId) && 
              newInv.status === 'accepted') {
            // New connection - no unread yet
            fetchInitialState();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, fetchInitialState]);

  // Simple getters - return 1 if has unread, 0 if not (for backwards compat)
  const getUnreadCount = (eventId: string): number => {
    return hasUnreadEvents[eventId] ? 1 : 0;
  };

  const getDmUnreadCount = (invitationId: string): number => {
    return hasUnreadDms[invitationId] ? 1 : 0;
  };

  // Check if ANY chat has unread (for the red dot on icon)
  const hasAnyUnread = (): boolean => {
    // Check non-muted events
    for (const eventId of Object.keys(hasUnreadEvents)) {
      if (hasUnreadEvents[eventId] && !mutedEventIdsRef.current.has(eventId)) {
        return true;
      }
    }
    // Check non-muted DMs
    for (const invId of Object.keys(hasUnreadDms)) {
      if (hasUnreadDms[invId] && !mutedInvitationIdsRef.current.has(invId)) {
        return true;
      }
    }
    return false;
  };

  // For backwards compat - returns 1 if any unread, 0 if none
  const getTotalUnreadCount = (): number => {
    return hasAnyUnread() ? 1 : 0;
  };

  // Clear unread when opening a conversation
  const clearUnreadForEvent = (eventId: string) => {
    setHasUnreadEvents(prev => {
      const next = { ...prev };
      delete next[eventId];
      return next;
    });
  };

  const clearUnreadForDm = (invitationId: string) => {
    setHasUnreadDms(prev => {
      const next = { ...prev };
      delete next[invitationId];
      return next;
    });
  };

  return {
    unreadCounts: hasUnreadEvents, // backwards compat
    dmUnreadCounts: hasUnreadDms,  // backwards compat
    getUnreadCount,
    getDmUnreadCount,
    getTotalUnreadCount,
    hasAnyUnread,
    clearUnreadForEvent,
    clearUnreadForDm,
    setActiveEventChat,
    setActiveDmChat,
    loading,
    refetch: fetchInitialState,
  };
};
