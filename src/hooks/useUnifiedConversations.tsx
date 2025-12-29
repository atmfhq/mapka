import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Export for real-time updates
export interface LastMessageUpdate {
  type: 'dm' | 'event';
  id: string; // invitationId or eventId
  messageAt: string;
  preview: string;
  senderId: string;
}

interface AvatarConfig {
  skinColor?: string;
  shape?: string;
  eyes?: string;
  mouth?: string;
}

export interface ConversationItem {
  id: string;
  type: 'pending_invite' | 'dm' | 'spot';
  title: string;
  subtitle: string;
  avatarConfig: AvatarConfig | null;
  avatarUrl?: string;
  lastActivityAt: Date;
  unreadCount: number;
  userId?: string;
  invitationId?: string;
  eventId?: string;
  activityType?: string;
  category?: string;
  senderId?: string;
}

interface PendingInvitation {
  id: string;
  sender_id: string;
  activity_type: string;
  created_at: string;
  sender?: {
    id: string;
    nick: string;
    avatar_config: unknown;
    avatar_url: string;
  };
}

interface ConnectedUser {
  id: string;
  nick: string;
  avatar_config: AvatarConfig | null;
  avatar_url: string;
  invitationId: string;
}

interface ActiveMission {
  id: string;
  title: string;
  category: string;
  host_id: string;
}

interface LastMessageInfo {
  invitationId?: string;
  eventId?: string;
  lastMessageAt: string;
  lastMessagePreview: string;
  lastMessageSenderId: string;
}

export const useUnifiedConversations = (
  currentUserId: string | null,
  pendingInvitations: PendingInvitation[],
  connectedUsers: ConnectedUser[],
  activeMissions: ActiveMission[],
  getEventUnreadCount: (eventId: string) => number,
  getDmUnreadCount: (invitationId: string) => number
) => {
  const [dmLastMessages, setDmLastMessages] = useState<Map<string, LastMessageInfo>>(new Map());
  const [eventLastMessages, setEventLastMessages] = useState<Map<string, LastMessageInfo>>(new Map());
  const [senderNicks, setSenderNicks] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  // Use refs to avoid dependency issues with arrays
  const connectedUsersRef = useRef(connectedUsers);
  const activeMissionsRef = useRef(activeMissions);
  
  // Update refs when data changes
  useEffect(() => {
    connectedUsersRef.current = connectedUsers;
  }, [connectedUsers]);
  
  useEffect(() => {
    activeMissionsRef.current = activeMissions;
  }, [activeMissions]);

  // Stable keys for dependency tracking
  const connectedUsersKey = connectedUsers.map(u => u.invitationId).join(',');
  const activeMissionsKey = activeMissions.map(m => m.id).join(',');

  // Fetch last messages for DMs
  const fetchDmLastMessages = useCallback(async () => {
    const users = connectedUsersRef.current;
    
    if (users.length === 0) {
      setDmLastMessages(new Map());
      return;
    }

    const invitationIds = users.map(u => u.invitationId).filter(Boolean);
    if (invitationIds.length === 0) {
      setDmLastMessages(new Map());
      return;
    }

    const newLastMessages = new Map<string, LastMessageInfo>();
    
    // Fetch last message for each DM conversation in parallel
    const promises = invitationIds.map(async (invId) => {
      const { data } = await supabase
        .from('direct_messages')
        .select('content, created_at, sender_id')
        .eq('invitation_id', invId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (data) {
        return {
          invId,
          info: {
            invitationId: invId,
            lastMessageAt: data.created_at,
            lastMessagePreview: data.content.slice(0, 50) + (data.content.length > 50 ? '...' : ''),
            lastMessageSenderId: data.sender_id,
          }
        };
      }
      return null;
    });

    const results = await Promise.all(promises);
    for (const result of results) {
      if (result) {
        newLastMessages.set(result.invId, result.info);
      }
    }

    setDmLastMessages(newLastMessages);
  }, []);

  // Fetch last messages for event chats
  const fetchEventLastMessages = useCallback(async () => {
    const missions = activeMissionsRef.current;
    
    if (missions.length === 0) {
      setEventLastMessages(new Map());
      return;
    }

    const eventIds = missions.map(m => m.id);
    const newLastMessages = new Map<string, LastMessageInfo>();
    const senderIdsToFetch = new Set<string>();
    
    // Fetch last message for each event in parallel
    const promises = eventIds.map(async (eventId) => {
      const { data } = await supabase
        .from('event_chat_messages')
        .select('content, created_at, user_id')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (data) {
        return {
          eventId,
          info: {
            eventId,
            lastMessageAt: data.created_at,
            lastMessagePreview: data.content.slice(0, 40) + (data.content.length > 40 ? '...' : ''),
            lastMessageSenderId: data.user_id,
          }
        };
      }
      return null;
    });

    const results = await Promise.all(promises);
    for (const result of results) {
      if (result) {
        newLastMessages.set(result.eventId, result.info);
        senderIdsToFetch.add(result.info.lastMessageSenderId);
      }
    }

    // Fetch sender nicknames for event messages
    if (senderIdsToFetch.size > 0) {
      const { data: profiles } = await supabase
        .rpc('get_public_profiles_by_ids', { user_ids: Array.from(senderIdsToFetch) });
      
      if (profiles) {
        const nickMap = new Map<string, string>();
        for (const p of profiles) {
          nickMap.set(p.id, p.nick || 'User');
        }
        setSenderNicks(nickMap);
      }
    }

    setEventLastMessages(newLastMessages);
  }, []);

  // Fetch all last messages when data changes
  useEffect(() => {
    let cancelled = false;
    
    const fetchAll = async () => {
      setLoading(true);
      try {
        await Promise.all([fetchDmLastMessages(), fetchEventLastMessages()]);
      } catch (err) {
        console.error('Error fetching conversation data:', err);
      }
      if (!cancelled) {
        setLoading(false);
      }
    };
    
    fetchAll();
    
    return () => {
      cancelled = true;
    };
  }, [connectedUsersKey, activeMissionsKey, fetchDmLastMessages, fetchEventLastMessages]);

  // Real-time subscription for DM messages - instant reordering
  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel('conversations-dm-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
        },
        (payload) => {
          const msg = payload.new as { invitation_id: string; content: string; created_at: string; sender_id: string };
          console.log('[UnifiedConversations] New DM received:', msg.invitation_id);
          
          // Update the lastMessages map immediately for instant reordering
          setDmLastMessages(prev => {
            const next = new Map(prev);
            next.set(msg.invitation_id, {
              invitationId: msg.invitation_id,
              lastMessageAt: msg.created_at,
              lastMessagePreview: msg.content.slice(0, 50) + (msg.content.length > 50 ? '...' : ''),
              lastMessageSenderId: msg.sender_id,
            });
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  // Real-time subscription for invitation changes - to pick up new connections immediately
  // Using broad subscription with client-side filtering for reliability
  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel(`conversations-inv-${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'invitations',
        },
        (payload) => {
          const updatedInv = payload.new as { sender_id: string; receiver_id: string; status: string };
          // Only process if this invitation involves the current user and was accepted
          if ((updatedInv.sender_id === currentUserId || updatedInv.receiver_id === currentUserId) &&
              updatedInv.status === 'accepted') {
            console.log('[UnifiedConversations] Invitation accepted, will refetch...');
            // The parent component's connectedUsers will update which triggers our useMemo
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  // Real-time subscription for event messages - instant reordering
  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel('conversations-event-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'event_chat_messages',
        },
        async (payload) => {
          const msg = payload.new as { event_id: string; content: string; created_at: string; user_id: string };
          
          // Fetch sender nick if we don't have it
          if (!senderNicks.has(msg.user_id) && msg.user_id !== currentUserId) {
            const { data: profiles } = await supabase
              .rpc('get_public_profiles_by_ids', { user_ids: [msg.user_id] });
            
            if (profiles && profiles[0]) {
              setSenderNicks(prev => {
                const next = new Map(prev);
                next.set(msg.user_id, profiles[0].nick || 'User');
                return next;
              });
            }
          }
          
          // Update the lastMessages map immediately for instant reordering
          setEventLastMessages(prev => {
            const next = new Map(prev);
            next.set(msg.event_id, {
              eventId: msg.event_id,
              lastMessageAt: msg.created_at,
              lastMessagePreview: msg.content.slice(0, 40) + (msg.content.length > 40 ? '...' : ''),
              lastMessageSenderId: msg.user_id,
            });
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, senderNicks]);

  // Build unified conversation list
  const conversations = useMemo((): ConversationItem[] => {
    const items: ConversationItem[] = [];

    // Add pending invitations
    for (const inv of pendingInvitations) {
      items.push({
        id: `invite-${inv.id}`,
        type: 'pending_invite',
        title: inv.sender?.nick || 'Unknown',
        subtitle: 'Wants to connect with you',
        avatarConfig: inv.sender?.avatar_config as AvatarConfig | null,
        avatarUrl: inv.sender?.avatar_url,
        lastActivityAt: new Date(inv.created_at),
        unreadCount: 0,
        userId: inv.sender_id,
        invitationId: inv.id,
        activityType: inv.activity_type,
        senderId: inv.sender_id,
      });
    }

    // Add connected users (DMs)
    for (const user of connectedUsers) {
      const lastMsg = dmLastMessages.get(user.invitationId);
      const unread = getDmUnreadCount(user.invitationId);
      
      let subtitle = 'Start a conversation';
      if (lastMsg) {
        const isOwn = lastMsg.lastMessageSenderId === currentUserId;
        subtitle = isOwn 
          ? `You: ${lastMsg.lastMessagePreview}` 
          : lastMsg.lastMessagePreview;
      }

      items.push({
        id: `dm-${user.id}`,
        type: 'dm',
        title: user.nick || 'Unknown',
        subtitle,
        avatarConfig: user.avatar_config,
        avatarUrl: user.avatar_url,
        lastActivityAt: lastMsg ? new Date(lastMsg.lastMessageAt) : new Date(0),
        unreadCount: unread,
        userId: user.id,
        invitationId: user.invitationId,
      });
    }

    // Add active missions (spots)
    for (const mission of activeMissions) {
      const lastMsg = eventLastMessages.get(mission.id);
      const unread = getEventUnreadCount(mission.id);
      
      let subtitle = 'No messages yet';
      if (lastMsg) {
        const senderNick = lastMsg.lastMessageSenderId === currentUserId 
          ? 'You' 
          : (senderNicks.get(lastMsg.lastMessageSenderId) || 'User');
        subtitle = `${senderNick}: ${lastMsg.lastMessagePreview}`;
      }

      items.push({
        id: `spot-${mission.id}`,
        type: 'spot',
        title: mission.title,
        subtitle,
        avatarConfig: null,
        lastActivityAt: lastMsg ? new Date(lastMsg.lastMessageAt) : new Date(0),
        unreadCount: unread,
        eventId: mission.id,
        category: mission.category,
      });
    }

    // Sort by lastActivityAt descending (newest first)
    items.sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime());

    return items;
  }, [
    pendingInvitations,
    connectedUsers,
    activeMissions,
    dmLastMessages,
    eventLastMessages,
    senderNicks,
    currentUserId,
    getEventUnreadCount,
    getDmUnreadCount,
  ]);

  const refetch = useCallback(async () => {
    await Promise.all([fetchDmLastMessages(), fetchEventLastMessages()]);
  }, [fetchDmLastMessages, fetchEventLastMessages]);

  return {
    conversations,
    loading,
    refetch,
  };
};
