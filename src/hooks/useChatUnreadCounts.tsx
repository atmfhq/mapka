import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UnreadCounts {
  [eventId: string]: number;
}

interface DirectMessageCounts {
  [invitationId: string]: number;
}

export const useChatUnreadCounts = (
  currentUserId: string | null, 
  eventIds: string[],
  mutedEventIds: Set<string> = new Set(),
  mutedInvitationIds: Set<string> = new Set()
) => {
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({});
  const [dmUnreadCounts, setDmUnreadCounts] = useState<DirectMessageCounts>({});
  const [loading, setLoading] = useState(true);
  const eventIdsRef = useRef<string[]>(eventIds);
  const mutedEventIdsRef = useRef<Set<string>>(mutedEventIds);
  const mutedInvitationIdsRef = useRef<Set<string>>(mutedInvitationIds);
  
  // Track currently active/open chats to prevent red dot for open conversations
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
  
  // Functions to set/clear active chats
  const setActiveEventChat = useCallback((eventId: string | null) => {
    activeEventChatRef.current = eventId;
  }, []);
  
  const setActiveDmChat = useCallback((invitationId: string | null) => {
    activeDmChatRef.current = invitationId;
  }, []);

  const fetchUnreadCounts = useCallback(async () => {
    if (!currentUserId) {
      setUnreadCounts({});
      setDmUnreadCounts({});
      setLoading(false);
      return;
    }

    try {
      // Fetch event chat unread counts
      if (eventIds.length > 0) {
        // Get user's last_read_at for each event they participate in
        const { data: participations } = await supabase
          .from('event_participants')
          .select('event_id, last_read_at')
          .eq('user_id', currentUserId)
          .in('event_id', eventIds);

        // Also check if user is host (they might not have a participant record)
        const { data: hostedEvents } = await supabase
          .from('megaphones')
          .select('id, created_at')
          .eq('host_id', currentUserId)
          .in('id', eventIds);

        // Build a map of event_id -> last_read_at
        const lastReadMap: { [eventId: string]: string } = {};
        
        for (const p of participations || []) {
          lastReadMap[p.event_id] = p.last_read_at || '1970-01-01T00:00:00Z';
        }

        // For hosted events without participation record, use created_at as fallback
        for (const h of hostedEvents || []) {
          if (!lastReadMap[h.id]) {
            lastReadMap[h.id] = h.created_at || '1970-01-01T00:00:00Z';
          }
        }

        // Now count unread messages for each event
        const counts: UnreadCounts = {};
        
        for (const eventId of eventIds) {
          const cutoffTime = lastReadMap[eventId] || '1970-01-01T00:00:00Z';
          
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
      } else {
        setUnreadCounts({});
      }

      // Fetch direct message unread counts
      const { data: invitations } = await supabase
        .from('invitations')
        .select('id, last_read_at')
        .eq('status', 'accepted')
        .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`);

      if (invitations && invitations.length > 0) {
        const dmCounts: DirectMessageCounts = {};
        
        for (const inv of invitations) {
          const cutoffTime = inv.last_read_at || '1970-01-01T00:00:00Z';
          
          const { count, error } = await supabase
            .from('direct_messages')
            .select('id', { count: 'exact', head: true })
            .eq('invitation_id', inv.id)
            .neq('sender_id', currentUserId)
            .gt('created_at', cutoffTime);

          if (!error && count !== null && count > 0) {
            dmCounts[inv.id] = count;
          }
        }

        setDmUnreadCounts(dmCounts);
      } else {
        setDmUnreadCounts({});
      }
    } catch (err) {
      console.error('useChatUnreadCounts: Error fetching counts:', err);
    }

    setLoading(false);
  }, [currentUserId, eventIds.join(',')]);

  useEffect(() => {
    fetchUnreadCounts();
  }, [fetchUnreadCounts]);

  // Subscribe to new event messages
  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel('chat-unread-events')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'event_chat_messages',
        },
        (payload) => {
          // If message is from someone else, increment count immediately
          if (payload.new.user_id !== currentUserId) {
            const eventId = payload.new.event_id;
            // Only update if we're tracking this event AND it's not currently open AND not muted
            if (
              eventIdsRef.current.includes(eventId) && 
              activeEventChatRef.current !== eventId &&
              !mutedEventIdsRef.current.has(eventId)
            ) {
              setUnreadCounts(prev => ({
                ...prev,
                [eventId]: (prev[eventId] || 0) + 1
              }));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  // Subscribe to new direct messages
  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel('chat-unread-dms')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
        },
        (payload) => {
          // If message is from someone else, increment count immediately
          if (payload.new.sender_id !== currentUserId) {
            const invitationId = payload.new.invitation_id;
            // Only increment if this DM chat is NOT currently open AND not muted
            if (
              activeDmChatRef.current !== invitationId &&
              !mutedInvitationIdsRef.current.has(invitationId)
            ) {
              setDmUnreadCounts(prev => ({
                ...prev,
                [invitationId]: (prev[invitationId] || 0) + 1
              }));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const getUnreadCount = (eventId: string): number => {
    return unreadCounts[eventId] || 0;
  };

  const getDmUnreadCount = (invitationId: string): number => {
    return dmUnreadCounts[invitationId] || 0;
  };

  const getTotalUnreadCount = (): number => {
    // Exclude muted chats from total count
    let eventTotal = 0;
    for (const [eventId, count] of Object.entries(unreadCounts)) {
      if (!mutedEventIdsRef.current.has(eventId)) {
        eventTotal += count;
      }
    }
    
    let dmTotal = 0;
    for (const [invId, count] of Object.entries(dmUnreadCounts)) {
      if (!mutedInvitationIdsRef.current.has(invId)) {
        dmTotal += count;
      }
    }
    
    return eventTotal + dmTotal;
  };

  const clearUnreadForEvent = (eventId: string) => {
    setUnreadCounts(prev => {
      const newCounts = { ...prev };
      delete newCounts[eventId];
      return newCounts;
    });
  };

  const clearUnreadForDm = (invitationId: string) => {
    setDmUnreadCounts(prev => {
      const newCounts = { ...prev };
      delete newCounts[invitationId];
      return newCounts;
    });
  };

  return {
    unreadCounts,
    dmUnreadCounts,
    getUnreadCount,
    getDmUnreadCount,
    getTotalUnreadCount,
    clearUnreadForEvent,
    clearUnreadForDm,
    setActiveEventChat,
    setActiveDmChat,
    loading,
    refetch: fetchUnreadCounts,
  };
};
