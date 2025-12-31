import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Export for real-time updates
export interface LastMessageUpdate {
  type: 'dm';
  id: string; // invitationId
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
  type: 'pending_invite' | 'dm';
  title: string;
  subtitle: string;
  avatarConfig: AvatarConfig | null;
  avatarUrl?: string;
  lastActivityAt: Date;
  unreadCount: number;
  userId?: string;
  invitationId?: string;
  activityType?: string;
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

interface LastMessageInfo {
  invitationId: string;
  lastMessageAt: string;
  lastMessagePreview: string;
  lastMessageSenderId: string;
}

export const useUnifiedConversations = (
  currentUserId: string | null,
  pendingInvitations: PendingInvitation[],
  connectedUsers: ConnectedUser[],
  getDmUnreadCount: (invitationId: string) => number
) => {
  const [dmLastMessages, setDmLastMessages] = useState<Map<string, LastMessageInfo>>(new Map());
  const [loading, setLoading] = useState(true);

  // Use refs to avoid dependency issues with arrays
  const connectedUsersRef = useRef(connectedUsers);
  
  // Update refs when data changes
  useEffect(() => {
    connectedUsersRef.current = connectedUsers;
  }, [connectedUsers]);

  // Stable keys for dependency tracking
  const connectedUsersKey = connectedUsers.map(u => u.invitationId).join(',');

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

  // Fetch all last messages when data changes
  useEffect(() => {
    let cancelled = false;
    
    const fetchAll = async () => {
      setLoading(true);
      try {
        await fetchDmLastMessages();
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
  }, [connectedUsersKey, fetchDmLastMessages]);

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

  // Build unified conversation list - DMs only, no spots/events
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

    // Add connected users (DMs only)
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

    // Sort by lastActivityAt descending (newest first)
    items.sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime());

    return items;
  }, [
    pendingInvitations,
    connectedUsers,
    dmLastMessages,
    currentUserId,
    getDmUnreadCount,
  ]);

  const refetch = useCallback(async () => {
    await fetchDmLastMessages();
  }, [fetchDmLastMessages]);

  return {
    conversations,
    loading,
    refetch,
  };
};
