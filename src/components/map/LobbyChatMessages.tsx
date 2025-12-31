import { useEffect, useRef, useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Send, Users, Crown, ChevronDown, Settings, UserX, Unlock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import AvatarDisplay from '@/components/avatar/AvatarDisplay';
import MessageReactions from '@/components/map/MessageReactions';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useMessageReactions } from '@/hooks/useMessageReactions';

interface AvatarConfig {
  skinColor?: string;
  shape?: string;
  eyes?: string;
  mouth?: string;
}

interface PublicProfile {
  id: string;
  nick: string;
  avatar_url: string;
  avatar_config: AvatarConfig | null;
  bio: string;
  tags: string[];
  location_lat: number;
  location_lng: number;
  is_active: boolean;
}

interface ChatMessage {
  id: string;
  event_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: PublicProfile;
}

interface Participant {
  id: string;
  user_id: string;
  status: string;
  chat_active: boolean;
  is_chat_banned?: boolean;
  profile?: PublicProfile;
}

interface LobbyChatMessagesProps {
  eventId: string;
  currentUserId: string;
  hostId?: string;
  host?: PublicProfile | null;
  participants?: Participant[];
  onParticipantsChange?: () => void;
}

const MAX_MESSAGE_LENGTH = 2000;
const MAX_VISIBLE_AVATARS = 4;

const LobbyChatMessages = ({ eventId, currentUserId, hostId, host, participants = [], onParticipantsChange }: LobbyChatMessagesProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isHost = currentUserId === hostId;

  // Message reactions
  const messageIds = messages.map(m => m.id);
  const { getReactions, toggleReaction } = useMessageReactions(messageIds, currentUserId);

  // Filter participants to exclude host and get active chat members (not banned)
  const activeChatMembers = useMemo(() => {
    return participants.filter(p => p.user_id !== hostId && p.chat_active && !p.is_chat_banned);
  }, [participants, hostId]);

  // Get all participants for management (excluding host)
  const allParticipantsForManagement = useMemo(() => {
    return participants.filter(p => p.user_id !== hostId);
  }, [participants, hostId]);

  // Total members including host
  const totalMembers = (host ? 1 : 0) + activeChatMembers.length;

  // Handle chat ban/unban
  const handleChatBan = async (participantId: string, userId: string, ban: boolean) => {
    const { error } = await supabase
      .from('event_participants')
      .update({ is_chat_banned: ban, chat_active: ban ? false : true })
      .eq('id', participantId);

    if (error) {
      toast({
        title: ban ? "Failed to remove from chat" : "Failed to restore chat access",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: ban ? "User removed from chat" : "Chat access restored",
      description: ban ? "They can still attend the event but cannot access the chat." : "User can now participate in the chat again.",
    });

    onParticipantsChange?.();
  };

  // Fetch all messages for the event (full history)
  useEffect(() => {
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('event_chat_messages')
        .select('id, event_id, user_id, content, created_at')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Failed to fetch messages:', error);
        return;
      }

      if (data) {
        // Fetch profiles using secure RPC function
        const userIds = [...new Set(data.map(m => m.user_id))];
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .rpc('get_public_profiles_by_ids', { user_ids: userIds });

          const messagesWithProfiles = data.map(msg => ({
            ...msg,
            profile: profiles?.find(p => p.id === msg.user_id) as PublicProfile | undefined,
          }));

          setMessages(messagesWithProfiles);
        } else {
          setMessages([]);
        }
      }
    };

    fetchMessages();
  }, [eventId]);

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel(`event-chat-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'event_chat_messages',
          filter: `event_id=eq.${eventId}`,
        },
        async (payload) => {
          const newMsg = payload.new as ChatMessage;
          
          // Fetch profile using secure RPC function
          const { data: profiles } = await supabase
            .rpc('get_public_profiles_by_ids', { user_ids: [newMsg.user_id] });
          
          const profile = profiles?.[0] as PublicProfile | undefined;

          setMessages(prev => [...prev, { ...newMsg, profile }]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  // Scroll anchor ref for reliable scrolling
  const scrollAnchorRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom using scroll anchor
  useEffect(() => {
    // Small delay to ensure DOM has updated
    const timer = setTimeout(() => {
      scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
    return () => clearTimeout(timer);
  }, [messages]);

  const handleSend = async () => {
    const trimmedMessage = newMessage.trim();
    if (!trimmedMessage) return;
    
    // Client-side validation
    if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      toast({
        title: "Message too long",
        description: `Messages must be ${MAX_MESSAGE_LENGTH} characters or less.`,
        variant: "destructive",
      });
      return;
    }
    
    setSending(true);

    const { error } = await supabase.from('event_chat_messages').insert({
      event_id: eventId,
      user_id: currentUserId,
      content: trimmedMessage,
    });

    setSending(false);

    if (error) {
      toast({
        title: "Failed to send",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setNewMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Group consecutive messages from the same user
  const groupedMessages = messages.reduce<{ messages: ChatMessage[]; showAvatar: boolean }[]>((acc, msg, idx) => {
    const prevMsg = messages[idx - 1];
    const isSameUser = prevMsg && prevMsg.user_id === msg.user_id;
    
    if (isSameUser) {
      // Add to last group, don't show avatar
      acc[acc.length - 1].messages.push(msg);
    } else {
      // Start new group, show avatar
      acc.push({ messages: [msg], showAvatar: true });
    }
    
    return acc;
  }, []);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Chat Header - Participant Visibility */}
      {(host || activeChatMembers.length > 0) && (
        <div className="flex items-center gap-2 mb-3">
          <button 
            onClick={() => setShowParticipantsModal(true)}
            className="flex-1 flex items-center gap-3 px-3 py-2.5 bg-muted/30 hover:bg-muted/50 rounded-xl transition-colors border border-border/30"
          >
            {/* Stacked avatars */}
            <div className="flex items-center -space-x-2">
              {/* Host avatar with crown */}
              {host && (
                <div className="relative z-10">
                  <div className="w-8 h-8 rounded-full ring-2 ring-card">
                    <AvatarDisplay 
                      config={host.avatar_config} 
                      size={32} 
                      showGlow={false}
                    />
                  </div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-warning rounded-full flex items-center justify-center ring-1 ring-card">
                    <span className="text-[8px]">👑</span>
                  </div>
                </div>
              )}
              
              {/* Participant avatars */}
              {activeChatMembers.slice(0, MAX_VISIBLE_AVATARS).map((participant, idx) => (
                <div 
                  key={participant.id} 
                  className="relative w-8 h-8 rounded-full ring-2 ring-card"
                  style={{ zIndex: MAX_VISIBLE_AVATARS - idx }}
                >
                  <AvatarDisplay 
                    config={participant.profile?.avatar_config} 
                    size={32} 
                    showGlow={false}
                  />
                </div>
              ))}
              
              {/* +N more indicator */}
              {activeChatMembers.length > MAX_VISIBLE_AVATARS && (
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center ring-2 ring-card text-xs font-medium text-muted-foreground">
                  +{activeChatMembers.length - MAX_VISIBLE_AVATARS}
                </div>
              )}
            </div>
            
            {/* Summary text */}
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-foreground">
                {host?.nick || 'Organizer'}
                {activeChatMembers.length > 0 && (
                  <span className="text-muted-foreground font-normal">
                    {' '}+ {activeChatMembers.length} other{activeChatMembers.length !== 1 ? 's' : ''}
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="w-3 h-3" />
                {totalMembers} in chat
              </p>
            </div>
            
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>

          {/* Host Settings Menu */}
          {isHost && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl bg-muted/30 border border-border/30">
                  <Settings className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowManageModal(true)}>
                  <Users className="w-4 h-4 mr-2" />
                  Manage Participants
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}

      {/* Participants Modal */}
      <Dialog open={showParticipantsModal} onOpenChange={setShowParticipantsModal}>
        <DialogContent className="max-w-sm max-h-[70vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Chat Participants
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="max-h-[50vh] pr-2">
            <div className="space-y-2">
              {/* Organizer */}
              {host && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-warning/10 border border-warning/30">
                  <div className="relative">
                    <div className="w-10 h-10">
                      <AvatarDisplay 
                        config={host.avatar_config} 
                        size={40} 
                        showGlow={false}
                      />
                    </div>
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-warning rounded-full flex items-center justify-center ring-2 ring-card">
                      <Crown className="w-3 h-3 text-warning-foreground" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{host.nick || 'Unknown'}</p>
                    <p className="text-xs text-warning font-medium">Organizer</p>
                  </div>
                </div>
              )}
              
              {/* Other participants */}
              {activeChatMembers.map((participant) => (
                <div key={participant.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/30">
                  <div className="w-10 h-10">
                    <AvatarDisplay 
                      config={participant.profile?.avatar_config} 
                      size={40} 
                      showGlow={false}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {participant.profile?.nick || 'Unknown'}
                    </p>
                    <p className="text-xs text-muted-foreground">Member</p>
                  </div>
                </div>
              ))}
              
              {activeChatMembers.length === 0 && !host && (
                <p className="text-center text-muted-foreground text-sm py-4">
                  No participants yet
                </p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Manage Participants Modal (Host Only) */}
      <Dialog open={showManageModal} onOpenChange={setShowManageModal}>
        <DialogContent className="max-w-sm max-h-[70vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Manage Chat Access
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="max-h-[50vh] pr-2">
            <div className="space-y-2">
              {allParticipantsForManagement.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-4">
                  No participants to manage
                </p>
              ) : (
                allParticipantsForManagement.map((participant) => {
                  const isBanned = participant.is_chat_banned;
                  return (
                    <div 
                      key={participant.id} 
                      className={`flex items-center gap-3 p-3 rounded-lg border ${
                        isBanned 
                          ? 'bg-destructive/10 border-destructive/30' 
                          : 'bg-muted/30 border-border/30'
                      }`}
                    >
                      <div className="w-10 h-10">
                        <AvatarDisplay 
                          config={participant.profile?.avatar_config} 
                          size={40} 
                          showGlow={false}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {participant.profile?.nick || 'Unknown'}
                        </p>
                        <p className={`text-xs ${isBanned ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {isBanned ? 'Removed from chat' : 'Active in chat'}
                        </p>
                      </div>
                      <Button
                        variant={isBanned ? "outline" : "destructive"}
                        size="sm"
                        onClick={() => handleChatBan(participant.id, participant.user_id, !isBanned)}
                        className="gap-1.5"
                      >
                        {isBanned ? (
                          <>
                            <Unlock className="w-3.5 h-3.5" />
                            Restore
                          </>
                        ) : (
                          <>
                            <UserX className="w-3.5 h-3.5" />
                            Remove
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
          
          <p className="text-xs text-muted-foreground mt-2">
            Removing a user from chat doesn't remove them from the event attendance.
          </p>
        </DialogContent>
      </Dialog>
      <ScrollArea className="flex-1 min-h-0 pr-2">
        <div className="space-y-4 py-2">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <p className="text-muted-foreground text-sm leading-relaxed">
                No messages yet.
              </p>
              <p className="text-muted-foreground/80 text-sm mt-1">
                Be the first to say hello!
              </p>
            </div>
          ) : (
            groupedMessages.map((group, groupIdx) => {
              const firstMsg = group.messages[0];
              const isOwn = firstMsg.user_id === currentUserId;
              
              return (
                <div key={groupIdx} className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Avatar - only for other users */}
                  {!isOwn && group.showAvatar ? (
                    <div className="w-8 h-8 flex-shrink-0">
                      <AvatarDisplay 
                        config={firstMsg.profile?.avatar_config} 
                        size={32} 
                        showGlow={false}
                      />
                    </div>
                  ) : !isOwn ? (
                    <div className="w-8 flex-shrink-0" />
                  ) : null}
                  
                  {/* Message bubbles */}
                  <div className={`flex flex-col gap-1 max-w-[75%] ${isOwn ? 'items-end' : 'items-start'}`}>
                    {/* Show nickname for first message in group (not own) */}
                    {!isOwn && group.showAvatar && (
                      <span className="text-xs font-medium text-muted-foreground ml-1">
                        {firstMsg.profile?.nick || 'Unknown'}
                      </span>
                    )}
                    
                    {group.messages.map((msg, msgIdx) => (
                      <div key={msg.id} className="flex flex-col gap-1">
                        <div
                          className={`rounded-2xl px-3 py-2 ${
                            isOwn
                              ? 'bg-primary text-primary-foreground rounded-br-md'
                              : 'bg-muted rounded-bl-md'
                          } ${msgIdx > 0 ? (isOwn ? 'rounded-tr-md' : 'rounded-tl-md') : ''}`}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                          <p
                            className={`text-[10px] mt-1 ${
                              isOwn ? 'text-primary-foreground/60' : 'text-muted-foreground'
                            }`}
                          >
                            {format(new Date(msg.created_at), 'h:mm a')}
                          </p>
                        </div>
                        {/* Reactions */}
                        <MessageReactions
                          reactions={getReactions(msg.id)}
                          onToggleReaction={(emoji) => toggleReaction(msg.id, emoji)}
                          isOwn={isOwn}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
          {/* Scroll anchor for auto-scroll */}
          <div ref={scrollAnchorRef} />
        </div>
      </ScrollArea>

      {/* Input - fixed at bottom */}
      <div className="flex gap-2 flex-shrink-0 pt-3 border-t border-border/50 pb-safe">
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          className="flex-1 bg-muted/50 border-border/50 rounded-full px-4 min-h-[44px]"
          maxLength={MAX_MESSAGE_LENGTH}
          disabled={sending}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={sending || !newMessage.trim()}
          className="bg-primary hover:bg-primary/90 rounded-full min-w-[44px] min-h-[44px]"
        >
          <Send className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
};

export default LobbyChatMessages;
