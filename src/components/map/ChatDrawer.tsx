import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { MessageCircle, Send, ChevronLeft, Loader2, Info, BellOff, Bell } from 'lucide-react';
import AvatarDisplay from '@/components/avatar/AvatarDisplay';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useConnectedUsers } from '@/hooks/useConnectedUsers';
import { useInvitationRealtime } from '@/hooks/useInvitationRealtime';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { useChatUnreadCounts } from '@/hooks/useChatUnreadCounts';
import { useMutedChats } from '@/hooks/useMutedChats';
import { useUnifiedConversations, type ConversationItem } from '@/hooks/useUnifiedConversations';
import ConversationRow from './ConversationRow';
import ProfileModal from './ProfileModal';
import LobbyChatMessages from './LobbyChatMessages';

interface ChatMessage {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
}

interface ActiveMission {
  id: string;
  title: string;
  category: string;
  host_id: string;
}

interface ChatDrawerProps {
  currentUserId: string;
  externalOpen?: boolean;
  externalUserId?: string | null;
  externalEventId?: string | null;
  onOpenChange?: (open: boolean) => void;
  onOpenMission?: (missionId: string) => void;
}

const MAX_MESSAGE_LENGTH = 2000;

const ChatDrawer = ({ 
  currentUserId, 
  externalOpen, 
  externalUserId,
  externalEventId,
  onOpenChange,
  onOpenMission 
}: ChatDrawerProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedSpot, setSelectedSpot] = useState<ActiveMission | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [activeMissions, setActiveMissions] = useState<ActiveMission[]>([]);
  const [loadingMissions, setLoadingMissions] = useState(true);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  
  const { connectedUsers, loading, refetch: refetchConnections, getInvitationIdForUser } = useConnectedUsers(currentUserId);
  const { pendingInvitations, pendingCount, refetch: refetchPending } = useInvitationRealtime(currentUserId);
  const { markInvitationAsRead, markEventAsRead, silentRefetch } = useUnreadMessages(currentUserId);
  const { mutedEventIds, mutedInvitationIds } = useMutedChats(currentUserId);

  // Collect all event IDs for per-chat unread counts
  const allEventIds = useMemo(() => {
    return activeMissions.map(mission => mission.id);
  }, [activeMissions]);

  const { 
    getUnreadCount: getEventUnreadCount, 
    getDmUnreadCount,
    getTotalUnreadCount,
    clearUnreadForEvent,
    clearUnreadForDm,
    setActiveEventChat,
    setActiveDmChat,
    refetch: refetchUnreadCounts 
  } = useChatUnreadCounts(currentUserId, allEventIds, mutedEventIds, mutedInvitationIds);

  // Unified conversations list
  const { conversations, loading: loadingConversations, refetch: refetchConversations } = useUnifiedConversations(
    currentUserId,
    pendingInvitations,
    connectedUsers.map(u => ({
      id: u.id,
      nick: u.nick,
      avatar_config: u.avatar_config,
      avatar_url: u.avatar_url,
      invitationId: u.invitationId,
    })),
    activeMissions,
    getEventUnreadCount,
    getDmUnreadCount
  );

  // Combine internal and external open states
  const isOpen = externalOpen || internalOpen;
  
  const handleOpenChange = (value: boolean) => {
    setInternalOpen(value);
    onOpenChange?.(value);
    if (!value) {
      setActiveDmChat(null);
      setActiveEventChat(null);
      setSelectedUser(null);
      setSelectedSpot(null);
      setMessages([]);
      silentRefetch();
    }
  };

  // Handle external user selection (from map click)
  useEffect(() => {
    if (externalUserId && externalOpen) {
      setSelectedUser(externalUserId);
      setSelectedSpot(null);
    }
  }, [externalUserId, externalOpen]);

  // Handle external spot selection (from QuestLobby "Open Chat")
  useEffect(() => {
    if (externalEventId && externalOpen) {
      const mission = activeMissions.find(m => m.id === externalEventId);
      if (mission) {
        setSelectedSpot(mission);
        setSelectedUser(null);
        setActiveEventChat(externalEventId);
        markEventAsRead(externalEventId);
        clearUnreadForEvent(externalEventId);
      }
    }
  }, [externalEventId, externalOpen, activeMissions]);

  // Fetch active missions (public megaphones where user is a participant)
  const fetchActiveMissions = useCallback(async () => {
    if (!currentUserId) return;
    
    setLoadingMissions(true);
    
    const { data: hostedMissions } = await supabase
      .from('megaphones')
      .select('id, title, category, host_id')
      .eq('host_id', currentUserId)
      .eq('is_private', false);

    const { data: participations } = await supabase
      .from('event_participants')
      .select('event_id')
      .eq('user_id', currentUserId)
      .eq('status', 'joined');

    const participatedEventIds = participations?.map(p => p.event_id) || [];
    
    let participatedMissions: ActiveMission[] = [];
    if (participatedEventIds.length > 0) {
      const { data } = await supabase
        .from('megaphones')
        .select('id, title, category, host_id')
        .in('id', participatedEventIds)
        .eq('is_private', false);
      participatedMissions = data || [];
    }

    const allMissions = [...(hostedMissions || []), ...participatedMissions];
    const uniqueMissions = allMissions.filter((m, i, arr) => 
      arr.findIndex(x => x.id === m.id) === i
    );

    const now = Date.now();
    const { data: fullMegaphones } = await supabase
      .from('megaphones')
      .select('id, start_time, duration_minutes')
      .in('id', uniqueMissions.map(m => m.id));

    const activeMissionIds = new Set(
      (fullMegaphones || [])
        .filter(m => {
          const endTime = new Date(m.start_time).getTime() + (m.duration_minutes * 60 * 1000);
          return endTime > now;
        })
        .map(m => m.id)
    );

    setActiveMissions(uniqueMissions.filter(m => activeMissionIds.has(m.id)));
    setLoadingMissions(false);
  }, [currentUserId]);

  useEffect(() => {
    fetchActiveMissions();
  }, [fetchActiveMissions]);

  const selectedUserData = connectedUsers.find(u => u.id === selectedUser);
  const invitationId = selectedUser ? getInvitationIdForUser(selectedUser) : null;

  // Fetch messages for direct chat
  const fetchMessages = useCallback(async () => {
    if (!invitationId) return;

    setLoadingMessages(true);
    const { data } = await supabase
      .from('direct_messages')
      .select('id, content, sender_id, created_at')
      .eq('invitation_id', invitationId)
      .order('created_at', { ascending: true });

    if (data) {
      setMessages(data.map(msg => ({
        id: msg.id,
        content: msg.content,
        user_id: msg.sender_id,
        created_at: msg.created_at,
      })));
    }
    setLoadingMessages(false);
  }, [invitationId]);

  useEffect(() => {
    if (selectedUser && invitationId) {
      fetchMessages();
    }
  }, [selectedUser, invitationId, fetchMessages]);

  // Realtime subscription for direct messages
  useEffect(() => {
    if (!invitationId) return;

    const channel = supabase
      .channel(`direct-chat-${invitationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `invitation_id=eq.${invitationId}`,
        },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [invitationId, fetchMessages]);

  // Auto-scroll to bottom
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
    return () => clearTimeout(timer);
  }, [messages, selectedUser]);

  const handleSendMessage = async () => {
    const trimmedMessage = newMessage.trim();
    if (!trimmedMessage || !invitationId) return;
    
    if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      toast({
        title: 'Message too long',
        description: `Messages must be ${MAX_MESSAGE_LENGTH} characters or less.`,
        variant: 'destructive',
      });
      return;
    }

    setSending(true);
    const { error } = await supabase.from('direct_messages').insert({
      invitation_id: invitationId,
      sender_id: currentUserId,
      content: trimmedMessage,
    });

    setSending(false);
    if (error) {
      if (error.message.includes('row-level security') || error.code === '42501') {
        toast({
          title: 'Connection Terminated',
          description: 'This connection has ended. Send a new signal to reconnect.',
          variant: 'destructive',
        });
        setSelectedUser(null);
        setMessages([]);
        refetchConnections();
      } else {
        toast({
          title: 'Failed to send message',
          description: error.message,
          variant: 'destructive',
        });
      }
    } else {
      setNewMessage('');
    }
  };

  const handleSelectConversation = (item: ConversationItem) => {
    if (item.type === 'dm' && item.userId) {
      setSelectedUser(item.userId);
      setSelectedSpot(null);
      setMessages([]);
      
      if (item.invitationId) {
        setActiveDmChat(item.invitationId);
        markInvitationAsRead(item.invitationId);
        clearUnreadForDm(item.invitationId);
      }
    } else if (item.type === 'spot' && item.eventId) {
      const mission = activeMissions.find(m => m.id === item.eventId);
      if (mission) {
        setSelectedSpot(mission);
        setSelectedUser(null);
        setActiveEventChat(item.eventId);
        markEventAsRead(item.eventId);
        clearUnreadForEvent(item.eventId);
      }
    }
  };

  const handleAcceptInvitation = async (invitationId: string, senderId: string, activityType: string) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('location_lat, location_lng')
      .eq('id', currentUserId)
      .single();

    const lat = profile?.location_lat ?? 0;
    const lng = profile?.location_lng ?? 0;

    const { error } = await supabase.rpc('accept_invitation', {
      p_invitation_id: invitationId,
      p_title: `Signal: ${activityType}`,
      p_category: activityType.toLowerCase(),
      p_lat: lat,
      p_lng: lng,
    });

    if (error) {
      toast({
        title: 'Failed to accept signal',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Signal Accepted!',
      description: 'You are now connected.',
    });

    refetchPending();
    setTimeout(() => {
      refetchConnections();
      refetchConversations();
    }, 300);
  };

  const handleDeclineInvitation = async (invitationId: string) => {
    const { error } = await supabase
      .from('invitations')
      .update({ status: 'declined' })
      .eq('id', invitationId);

    if (error) {
      toast({
        title: 'Failed to decline signal',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    refetchPending();
  };

  const totalBadgeCount = pendingCount + getTotalUnreadCount();
  const isLoading = loading || loadingMissions || loadingConversations;

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative min-w-[44px] min-h-[44px] text-muted-foreground hover:text-foreground"
          onClick={() => setInternalOpen(true)}
        >
          <MessageCircle className="w-5 h-5" />
          {totalBadgeCount > 0 && (
            <span className={`absolute top-1 right-1 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center ${
              pendingCount > 0 
                ? 'bg-warning text-warning-foreground animate-pulse' 
                : 'bg-destructive text-destructive-foreground'
            }`}>
              {totalBadgeCount > 99 ? '99+' : totalBadgeCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh]">
        <SheetHeader>
          <SheetTitle className="font-fredoka text-xl flex items-center gap-2">
            {selectedUser ? (
              <div className="flex items-center gap-2 flex-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8"
                  onClick={() => {
                    setActiveDmChat(null);
                    setSelectedUser(null);
                    setMessages([]);
                  }}
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <button
                  className="w-9 h-9 hover:opacity-80 transition-opacity"
                  onClick={() => setProfileModalOpen(true)}
                >
                  <AvatarDisplay 
                    config={selectedUserData?.avatar_config} 
                    size={36} 
                    showGlow={false} 
                  />
                </button>
                <button
                  className="flex-1 text-left hover:opacity-80 transition-opacity"
                  onClick={() => setProfileModalOpen(true)}
                >
                  <span className="font-semibold">{selectedUserData?.nick || 'Unknown'}</span>
                </button>
              </div>
            ) : selectedSpot ? (
              <div className="flex items-center gap-2 flex-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8"
                  onClick={() => {
                    setActiveEventChat(null);
                    setSelectedSpot(null);
                  }}
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <span className="font-semibold flex-1">{selectedSpot.title}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8"
                  onClick={() => {
                    handleOpenChange(false);
                    onOpenMission?.(selectedSpot.id);
                  }}
                  title="Spot Details"
                >
                  <Info className="w-5 h-5" />
                </Button>
              </div>
            ) : (
              <>
                <MessageCircle className="w-5 h-5 text-success" />
                Messages
              </>
            )}
          </SheetTitle>
        </SheetHeader>

        {!selectedUser && !selectedSpot ? (
          <ScrollArea className="h-[60vh] mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border/50 rounded-lg">
                <MessageCircle className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground/60 text-sm">
                  No conversations yet
                </p>
                <p className="text-muted-foreground/40 text-xs mt-1">
                  Connect with users on the map to start chatting
                </p>
              </div>
            ) : (
              <div className="space-y-2 pr-2">
                {conversations.map((item) => (
                  <ConversationRow
                    key={item.id}
                    item={item}
                    onSelect={handleSelectConversation}
                    onAcceptInvite={handleAcceptInvitation}
                    onDeclineInvite={handleDeclineInvitation}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        ) : selectedSpot ? (
          /* Spot Chat View */
          <div className="flex flex-col h-[60vh] mt-4">
            <LobbyChatMessages 
              eventId={selectedSpot.id} 
              currentUserId={currentUserId} 
            />
          </div>
        ) : (
          /* DM Chat View */
          <div className="flex flex-col h-[60vh] mt-4">
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-3">
                {loadingMessages ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : !invitationId ? (
                  <p className="text-center text-muted-foreground text-sm py-8">
                    No active connection. Accept an invitation to start chatting.
                  </p>
                ) : messages.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-8">
                    No messages yet. Start the conversation!
                  </p>
                ) : (
                  messages.map((msg) => {
                    const isOwn = msg.user_id === currentUserId;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg px-3 py-2 ${
                            isOwn
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <p className="text-sm">{msg.content}</p>
                          <p
                            className={`text-[10px] mt-1 ${
                              isOwn ? 'text-primary-foreground/60' : 'text-muted-foreground'
                            }`}
                          >
                            {format(new Date(msg.created_at), 'h:mm a')}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={scrollAnchorRef} />
              </div>
            </ScrollArea>

            {invitationId && (
              <div className="flex gap-2 mt-4 pt-4 border-t border-border/50">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                  placeholder="Type a message..."
                  className="flex-1"
                  maxLength={MAX_MESSAGE_LENGTH}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                />
                <Button
                  size="icon"
                  onClick={handleSendMessage}
                  disabled={sending || !newMessage.trim()}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </SheetContent>

      {selectedUserData && (
        <ProfileModal
          open={profileModalOpen}
          onOpenChange={setProfileModalOpen}
          user={{
            id: selectedUserData.id,
            nick: selectedUserData.nick,
            avatar_url: selectedUserData.avatar_url,
            avatar_config: selectedUserData.avatar_config,
            tags: selectedUserData.tags,
            bio: selectedUserData.bio,
          }}
          currentUserId={currentUserId}
          isConnected={true}
          invitationId={invitationId || undefined}
          onOpenChat={() => {
            setProfileModalOpen(false);
          }}
          onDisconnect={() => {
            setProfileModalOpen(false);
            setSelectedUser(null);
            setMessages([]);
            refetchConnections();
          }}
          onCloseChat={() => {
            handleOpenChange(false);
          }}
          onNavigate={(path) => navigate(path)}
        />
      )}
    </Sheet>
  );
};

export default ChatDrawer;
