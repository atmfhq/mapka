import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AvatarConfig {
  skinColor?: string;
  shape?: string;
  eyes?: string;
  mouth?: string;
}

export interface ConversationItem {
  id: string;
  type: 'pending_invite' | 'dm' | 'spot';
  // Display info
  title: string;
  subtitle: string;
  avatarConfig: AvatarConfig | null;
  avatarUrl?: string;
  // Timestamp for sorting
  lastActivityAt: Date;
  // Unread count (for DMs and spots)
  unreadCount: number;
  // Type-specific data
  userId?: string; // For DMs and pending invites
  invitationId?: string; // For DMs and pending invites  
  eventId?: string; // For spots
  activityType?: string; // For pending invites
  category?: string; // For spots
  // For pending invite actions
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

  // Fetch last messages for DMs
  const fetchDmLastMessages = useCallback(async () => {
    if (connectedUsers.length === 0) {
      setDmLastMessages(new Map());
      return;
    }

    const invitationIds = connectedUsers.map(u => u.invitationId).filter(Boolean);
    if (invitationIds.length === 0) return;

    const newLastMessages = new Map<string, LastMessageInfo>();
    
    // Fetch last message for each DM conversation
    for (const invId of invitationIds) {
      const { data } = await supabase
        .from('direct_messages')
        .select('content, created_at, sender_id')
        .eq('invitation_id', invId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (data) {
        newLastMessages.set(invId, {
          invitationId: invId,
          lastMessageAt: data.created_at,
          lastMessagePreview: data.content.slice(0, 50) + (data.content.length > 50 ? '...' : ''),
          lastMessageSenderId: data.sender_id,
        });
      }
    }

    setDmLastMessages(newLastMessages);
  }, [connectedUsers]);

  // Fetch last messages for event chats
  const fetchEventLastMessages = useCallback(async () => {
    if (activeMissions.length === 0) {
      setEventLastMessages(new Map());
      return;
    }

    const eventIds = activeMissions.map(m => m.id);
    const newLastMessages = new Map<string, LastMessageInfo>();
    const senderIdsToFetch = new Set<string>();
    
    // Fetch last message for each event
    for (const eventId of eventIds) {
      const { data } = await supabase
        .from('event_chat_messages')
        .select('content, created_at, user_id')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (data) {
        newLastMessages.set(eventId, {
          eventId,
          lastMessageAt: data.created_at,
          lastMessagePreview: data.content.slice(0, 40) + (data.content.length > 40 ? '...' : ''),
          lastMessageSenderId: data.user_id,
        });
        senderIdsToFetch.add(data.user_id);
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
  }, [activeMissions]);

  // Fetch all last messages when data changes
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      await Promise.all([fetchDmLastMessages(), fetchEventLastMessages()]);
      setLoading(false);
    };
    fetchAll();
  }, [fetchDmLastMessages, fetchEventLastMessages]);

  // Build unified conversation list
  const conversations = useMemo((): ConversationItem[] => {
    const items: ConversationItem[] = [];

    // Add pending invitations
    for (const inv of pendingInvitations) {
      items.push({
        id: `invite-${inv.id}`,
        type: 'pending_invite',
        title: inv.sender?.nick || 'Unknown',
        subtitle: `Sent you an invite • ${inv.activity_type}`,
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
    // Pending invites with no messages come first, then by timestamp
    items.sort((a, b) => {
      // Pending invites always have priority when recently received
      const aIsPending = a.type === 'pending_invite';
      const bIsPending = b.type === 'pending_invite';
      
      // Both same type or both not pending - sort by timestamp
      return b.lastActivityAt.getTime() - a.lastActivityAt.getTime();
    });

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

  return {
    conversations,
    loading,
    refetch: useCallback(async () => {
      await Promise.all([fetchDmLastMessages(), fetchEventLastMessages()]);
    }, [fetchDmLastMessages, fetchEventLastMessages]),
  };
};
