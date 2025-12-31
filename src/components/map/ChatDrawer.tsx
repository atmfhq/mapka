import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { MessageCircle, Send, ChevronLeft, Loader2, X } from 'lucide-react';
import AvatarDisplay from '@/components/avatar/AvatarDisplay';
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
import { useDmMessageReactions } from '@/hooks/useDmMessageReactions';
import ConversationRow from './ConversationRow';
import ProfileModal from './ProfileModal';
import MessageReactions from './MessageReactions';

interface ChatMessage {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
}

interface AvatarConfig {
  skinColor?: string;
  shape?: string;
  eyes?: string;
  mouth?: string;
}

interface ChatDrawerProps {
  currentUserId: string;
  externalOpen?: boolean;
  externalUserId?: string | null;
  onOpenChange?: (open: boolean) => void;
}

const MAX_MESSAGE_LENGTH = 2000;

const ChatDrawer = ({ 
  currentUserId, 
  externalOpen, 
  externalUserId,
  onOpenChange,
}: ChatDrawerProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  
  const { connectedUsers, loading, refetch: refetchConnections, getInvitationIdForUser } = useConnectedUsers(currentUserId);
  const { pendingInvitations, pendingCount, refetch: refetchPending } = useInvitationRealtime(currentUserId);
  const { markInvitationAsRead, silentRefetch } = useUnreadMessages(currentUserId);
  const { mutedInvitationIds } = useMutedChats(currentUserId);

  const { 
    getDmUnreadCount,
    getTotalUnreadCount,
    clearUnreadForDm,
    setActiveDmChat,
  } = useChatUnreadCounts(currentUserId, [], new Set(), mutedInvitationIds);

  // Unified conversations list - DMs only
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
    getDmUnreadCount
  );

  // Combine internal and external open states
  const isOpen = externalOpen || internalOpen;
  
  const handleOpenChange = (value: boolean) => {
    setInternalOpen(value);
    onOpenChange?.(value);
    if (!value) {
      setActiveDmChat(null);
      setSelectedUser(null);
      setMessages([]);
      silentRefetch();
    }
  };

  const handleClose = () => {
    handleOpenChange(false);
  };

  // Handle external user selection (from map click)
  useEffect(() => {
    if (externalUserId && externalOpen) {
      setSelectedUser(externalUserId);
    }
  }, [externalUserId, externalOpen]);



  const selectedUserData = connectedUsers.find(u => u.id === selectedUser);
  const invitationId = selectedUser ? getInvitationIdForUser(selectedUser) : null;

  // DM message reactions
  const dmMessageIds = useMemo(() => messages.map(m => m.id), [messages]);
  const { getReactions: getDmReactions, toggleReaction: toggleDmReaction } = useDmMessageReactions(dmMessageIds, currentUserId);

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
      setMessages([]);
      
      if (item.invitationId) {
        setActiveDmChat(item.invitationId);
        markInvitationAsRead(item.invitationId);
        clearUnreadForDm(item.invitationId);
      }
    }
  };

  const handleAcceptInvitation = async (invitationId: string, senderId: string, _activityType: string) => {
    // Simplified: just accept the invitation - no spot creation needed
    const { error } = await supabase.rpc('accept_invitation', {
      p_invitation_id: invitationId,
    });

    if (error) {
      toast({
        title: 'Failed to accept connection',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Connected!',
      description: 'You can now start chatting.',
    });

    refetchPending();
    // Refetch connections immediately for instant UI update
    refetchConnections();
    refetchConversations();
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
  const isLoading = loading || loadingConversations;

  // Trigger button (always rendered)
  const triggerButton = (
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
  );

  if (!isOpen) {
    return triggerButton;
  }

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center" style={{ isolation: 'isolate' }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-card border-2 border-border rounded-t-2xl sm:rounded-2xl shadow-hard w-full sm:max-w-md max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-4 fade-in duration-300 z-10">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            {selectedUser ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 shrink-0"
                  onClick={() => {
                    setActiveDmChat(null);
                    setSelectedUser(null);
                    setMessages([]);
                  }}
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <button
                  className="w-9 h-9 hover:opacity-80 transition-opacity shrink-0"
                  onClick={() => setProfileModalOpen(true)}
                >
                  <AvatarDisplay 
                    config={selectedUserData?.avatar_config} 
                    size={36} 
                    showGlow={false} 
                  />
                </button>
                <button
                  className="flex-1 text-left hover:opacity-80 transition-opacity min-w-0"
                  onClick={() => setProfileModalOpen(true)}
                >
                  <span className="font-nunito font-bold text-foreground truncate block">
                    {selectedUserData?.nick || 'Unknown'}
                  </span>
                </button>
              </>
            ) : (
              <div>
                <h3 className="font-nunito font-bold text-foreground">Messages</h3>
                <p className="text-xs text-muted-foreground">
                  {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
                </p>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
            className="rounded-lg hover:bg-muted shrink-0"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </Button>
        </div>

        {/* Content */}
        {!selectedUser ? (
          <ScrollArea className="flex-1 overflow-auto">
            <div className="p-4">
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
                <div className="space-y-2">
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
            </div>
          </ScrollArea>
        ) : (
          /* DM Chat View */
          <>
            <ScrollArea className="flex-1 overflow-auto">
              <div className="p-4 space-y-3">
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
                    const reactions = getDmReactions(msg.id);
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
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
                        <MessageReactions
                          reactions={reactions}
                          onToggleReaction={(emoji) => toggleDmReaction(msg.id, emoji)}
                          isOwn={isOwn}
                        />
                      </div>
                    );
                  })
                )}
                <div ref={scrollAnchorRef} />
              </div>
            </ScrollArea>

            {/* Message input - pinned to bottom */}
            {invitationId && (
              <div className="p-4 border-t border-border shrink-0">
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                    placeholder="Type a message..."
                    className="flex-1 bg-muted/50 border-border"
                    maxLength={MAX_MESSAGE_LENGTH}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                  />
                  <Button
                    size="icon"
                    onClick={handleSendMessage}
                    disabled={sending || !newMessage.trim()}
                    className="shrink-0 bg-primary hover:bg-primary/90"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

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
            handleClose();
          }}
          onNavigate={(path) => navigate(path)}
        />
      )}
    </div>
  );

  return (
    <>
      {triggerButton}
      {createPortal(modalContent, document.body)}
    </>
  );
};

export default ChatDrawer;
