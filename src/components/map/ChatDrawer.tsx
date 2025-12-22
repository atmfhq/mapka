import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { format } from 'date-fns';
import { MessageCircle, User, Send, ChevronLeft, Loader2, Users, Megaphone, Radio } from 'lucide-react';
import AvatarDisplay from '@/components/avatar/AvatarDisplay';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useConnectedUsers } from '@/hooks/useConnectedUsers';
import { useInvitationRealtime } from '@/hooks/useInvitationRealtime';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { useChatUnreadCounts } from '@/hooks/useChatUnreadCounts';

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
  onOpenChange?: (open: boolean) => void;
  onOpenMission?: (missionId: string) => void;
}

const MAX_MESSAGE_LENGTH = 2000;

const ChatDrawer = ({ 
  currentUserId, 
  externalOpen, 
  externalUserId, 
  onOpenChange,
  onOpenMission 
}: ChatDrawerProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [activeMissions, setActiveMissions] = useState<ActiveMission[]>([]);
  const [loadingMissions, setLoadingMissions] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { connectedUsers, loading, refetch: refetchConnections, getInvitationIdForUser } = useConnectedUsers(currentUserId);
  const { pendingInvitations, pendingCount, refetch: refetchPending } = useInvitationRealtime(currentUserId);
  const { unreadCount, markInvitationAsRead, markEventAsRead, silentRefetch } = useUnreadMessages(currentUserId);

  // Collect all event IDs for per-chat unread counts (only for public missions now)
  const allEventIds = useMemo(() => {
    return activeMissions.map(mission => mission.id);
  }, [activeMissions]);

  const { getUnreadCount: getEventUnreadCount, refetch: refetchUnreadCounts } = useChatUnreadCounts(currentUserId, allEventIds);

  // Combine internal and external open states
  const isOpen = externalOpen || internalOpen;
  
  const handleOpenChange = (value: boolean) => {
    setInternalOpen(value);
    onOpenChange?.(value);
    if (!value) {
      setSelectedUser(null);
      setMessages([]);
      // Silent refetch when drawer closes to ensure consistency
      silentRefetch();
    }
  };

  // Handle external user selection (from map click)
  useEffect(() => {
    if (externalUserId && externalOpen) {
      console.log('ChatDrawer: Opening for external user:', externalUserId);
      setSelectedUser(externalUserId);
    }
  }, [externalUserId, externalOpen]);

  // Fetch active missions (public megaphones where user is a participant)
  const fetchActiveMissions = useCallback(async () => {
    if (!currentUserId) return;
    
    setLoadingMissions(true);
    
    // Get megaphones where user is host
    const { data: hostedMissions } = await supabase
      .from('megaphones')
      .select('id, title, category, host_id')
      .eq('host_id', currentUserId)
      .eq('is_private', false);

    // Get megaphones where user is participant
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

    // Combine and dedupe
    const allMissions = [...(hostedMissions || []), ...participatedMissions];
    const uniqueMissions = allMissions.filter((m, i, arr) => 
      arr.findIndex(x => x.id === m.id) === i
    );

    // Filter active (not expired)
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

  // Fetch messages for direct chat (based on invitation)
  const fetchMessages = useCallback(async () => {
    if (!invitationId) return;

    setLoadingMessages(true);
    const { data } = await supabase
      .from('direct_messages')
      .select('id, content, sender_id, created_at')
      .eq('invitation_id', invitationId)
      .order('created_at', { ascending: true });

    if (data) {
      // Map sender_id to user_id for consistency with UI
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

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    const trimmedMessage = newMessage.trim();
    if (!trimmedMessage || !invitationId) return;
    
    // Client-side validation
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
      // Check if it's a policy violation (connection terminated)
      if (error.message.includes('row-level security') || error.code === '42501') {
        toast({
          title: 'Connection Terminated',
          description: 'This connection has ended. Send a new signal to reconnect.',
          variant: 'destructive',
        });
        // Go back to list view
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

  const handleSelectUser = (userId: string) => {
    setSelectedUser(userId);
    setMessages([]);
    
    // Background sync: Mark chat as read (fire and forget)
    const userInvitationId = getInvitationIdForUser(userId);
    if (userInvitationId) {
      markInvitationAsRead(userInvitationId);
    }
  };

  const handleOpenMission = (missionId: string) => {
    // Background sync: Mark mission as read (fire and forget)
    markEventAsRead(missionId);
    // Refetch counts after marking as read
    setTimeout(() => refetchUnreadCounts(), 500);
    
    handleOpenChange(false);
    onOpenMission?.(missionId);
  };

  const handleAcceptInvitation = async (invitationId: string, senderId: string, activityType: string) => {
    // Get current user's location from their profile - prioritize location_lat/lng over base_lat/lng
    const { data: profile } = await supabase
      .from('profiles')
      .select('base_lat, base_lng, location_lat, location_lng')
      .eq('id', currentUserId)
      .single();

    // Prioritize teleport location over base location
    const lat = profile?.location_lat ?? profile?.base_lat ?? 0;
    const lng = profile?.location_lng ?? profile?.base_lng ?? 0;

    const { data, error } = await supabase.rpc('accept_invitation', {
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

    // Immediately update pending invitations UI
    refetchPending();
    
    // Small delay to ensure database transaction completes, then refetch connections
    // This ensures the megaphone and participant records are created before we fetch
    setTimeout(() => {
      console.log('ChatDrawer: Refetching connections after accept...');
      refetchConnections();
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

  // Badge shows pending invitations + unread messages
  const totalBadgeCount = pendingCount + unreadCount;

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
          <SheetTitle className="font-orbitron text-xl flex items-center gap-2">
            {selectedUser ? (
              <div className="flex items-center gap-2 flex-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8"
                  onClick={() => {
                    setSelectedUser(null);
                    setMessages([]);
                  }}
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <div className="w-9 h-9 rounded-xl overflow-hidden border-2 border-success">
                  <AvatarDisplay 
                    config={selectedUserData?.avatar_config} 
                    size={36} 
                    showGlow={false} 
                  />
                </div>
                <span className="flex-1 font-semibold">{selectedUserData?.nick || 'Unknown'}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    toast({ title: 'Profile view coming soon' });
                  }}
                >
                  <User className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <>
                <MessageCircle className="w-5 h-5 text-success" />
                Comms Center
              </>
            )}
          </SheetTitle>
        </SheetHeader>

        {!selectedUser ? (
          <ScrollArea className="h-[60vh] mt-4">
            <div className="space-y-6">
              {/* Section: Pending Signals (Incoming Invitations) */}
              {pendingInvitations.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Radio className="w-4 h-4 text-warning animate-pulse" />
                    <h3 className="font-orbitron text-sm font-semibold text-warning">
                      INCOMING SIGNALS
                    </h3>
                    <Badge variant="outline" className="text-xs bg-warning/20 text-warning border-warning/40 animate-pulse">
                      {pendingInvitations.length}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    {pendingInvitations.map((inv) => (
                      <div
                        key={inv.id}
                        className="p-3 rounded-lg bg-warning/10 border border-warning/30 space-y-3"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10 border-2 border-warning">
                            <AvatarImage src={inv.sender?.avatar_url || undefined} />
                            <AvatarFallback className="bg-warning/20 text-warning">
                              {inv.sender?.nick?.[0]?.toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-semibold text-sm">{inv.sender?.nick || 'Unknown'}</p>
                            <p className="text-xs text-warning">{inv.activity_type}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1 bg-success hover:bg-success/90 text-success-foreground"
                            onClick={() => handleAcceptInvitation(inv.id, inv.sender_id, inv.activity_type)}
                          >
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 border-destructive/50 text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeclineInvitation(inv.id)}
                          >
                            Decline
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section A: Direct Signals (Private Chats) - Horizontal Avatar Row */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-success" />
                  <h3 className="font-orbitron text-sm font-semibold text-success">
                    OPERATIVES
                  </h3>
                  {connectedUsers.length > 0 && (
                    <Badge variant="outline" className="text-xs bg-success/20 text-success border-success/40">
                      {connectedUsers.length}
                    </Badge>
                  )}
                </div>
                
                {loading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : connectedUsers.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-border/50 rounded-lg">
                    <Users className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-muted-foreground/60 text-xs">
                      No active signals
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="w-full">
                    <div className="flex gap-3 pb-3">
                      {connectedUsers.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => handleSelectUser(user.id)}
                          className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-success/10 transition-colors min-w-[72px]"
                        >
                          <div className="relative">
                            <div className="w-14 h-14 rounded-xl overflow-hidden border-2 border-success shadow-[0_0_12px_rgba(34,197,94,0.4)]">
                              <AvatarDisplay
                                config={user.avatar_config} 
                                size={56} 
                                showGlow={false} 
                              />
                            </div>
                            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-success rounded-full border-2 border-background" />
                          </div>
                          <span className="text-xs font-medium text-foreground truncate max-w-[64px]">
                            {user.nick || 'Unknown'}
                          </span>
                        </button>
                      ))}
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                )}
              </div>

              {/* Section B: Active Missions (Event Chats) */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Megaphone className="w-4 h-4 text-primary" />
                  <h3 className="font-orbitron text-sm font-semibold text-primary">
                    SQUAD MISSIONS
                  </h3>
                  {activeMissions.length > 0 && (
                    <Badge variant="outline" className="text-xs bg-primary/20 text-primary border-primary/40">
                      {activeMissions.length}
                    </Badge>
                  )}
                </div>
                
                {loadingMissions ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : activeMissions.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-border/50 rounded-lg">
                    <Megaphone className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-muted-foreground/60 text-xs">
                      No active missions
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeMissions.map((mission) => {
                      const missionUnread = getEventUnreadCount(mission.id);
                      
                      return (
                        <button
                          key={mission.id}
                          onClick={() => handleOpenMission(mission.id)}
                          className="w-full p-3 rounded-lg bg-primary/10 border border-primary/30 hover:border-primary/60 transition-colors flex items-center gap-3"
                        >
                          <div className="relative w-10 h-10 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
                            <Megaphone className="w-5 h-5 text-primary" />
                            {missionUnread > 0 && (
                              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center">
                                {missionUnread > 9 ? '9+' : missionUnread}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 text-left">
                            <p className={`font-semibold text-sm ${missionUnread > 0 ? 'text-foreground' : ''}`}>
                              {mission.title}
                            </p>
                            <p className="text-xs text-primary capitalize">{mission.category}</p>
                          </div>
                          {missionUnread > 0 ? (
                            <Badge className="bg-destructive text-destructive-foreground border-destructive text-xs">
                              {missionUnread} new
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-primary/20 text-primary border-primary/40 text-xs">
                              Live
                            </Badge>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        ) : (
          // Chat view
          <div className="flex flex-col h-[60vh] mt-4">
            <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
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
    </Sheet>
  );
};

export default ChatDrawer;