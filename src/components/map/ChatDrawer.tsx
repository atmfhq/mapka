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
import { useTypingPresence } from '@/hooks/useTypingPresence';
import ConversationRow from './ConversationRow';
import ProfileModal from './ProfileModal';
import MessageReactions from './MessageReactions';
import TypingIndicator from './TypingIndicator';

interface ChatMessage {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  isOptimistic?: boolean; // Flag for optimistic messages
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
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const isUserAtBottomRef = useRef(true); // Track if user is scrolled to bottom
  
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
      // Clear active chat when drawer closes so red dot can show for new messages
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

  // Typing presence
  const { isOtherUserTyping, setTyping, clearTypingForUser } = useTypingPresence(invitationId, currentUserId, selectedUser);

  // Fetch messages for direct chat (only on initial load or conversation switch)
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
      // After loading, scroll to bottom and mark as at bottom
      isUserAtBottomRef.current = true;
      setTimeout(() => {
        scrollAnchorRef.current?.scrollIntoView({ behavior: 'auto' });
      }, 100);
    }
    setLoadingMessages(false);
  }, [invitationId]);

  useEffect(() => {
    if (selectedUser && invitationId) {
      fetchMessages();
      // Set active DM chat so red dot doesn't show for currently viewed chat
      setActiveDmChat(invitationId);
    } else {
      // Clear active chat when no chat is selected
      setActiveDmChat(null);
    }
  }, [selectedUser, invitationId, fetchMessages, setActiveDmChat]);

  // Realtime subscription for direct messages - append directly without refetch
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
        (payload) => {
          const newMsg = payload.new as {
            id: string;
            content: string;
            sender_id: string;
            created_at: string;
          };

          // KILL SWITCH: Clear typing indicator immediately when message is received
          if (newMsg.sender_id !== currentUserId && newMsg.sender_id === selectedUser) {
            // The other user sent a message - clear their typing indicator immediately
            clearTypingForUser(newMsg.sender_id);
          }

          // Check for duplicates - don't add if message already exists
          setMessages(prev => {
            // Check if message already exists (could be from optimistic update or already processed)
            const existingIndex = prev.findIndex(m => m.id === newMsg.id);
            if (existingIndex !== -1) {
              // Message already exists - just ensure it's not marked as optimistic
              return prev.map(m => 
                m.id === newMsg.id
                  ? {
                      id: newMsg.id,
                      content: newMsg.content,
                      user_id: newMsg.sender_id,
                      created_at: newMsg.created_at,
                    }
                  : m
              );
            }
            
            // Check if there's an optimistic message with matching content and sender (race condition handling)
            const optimisticIndex = prev.findIndex(m => 
              m.isOptimistic && 
              m.content === newMsg.content && 
              m.user_id === newMsg.sender_id &&
              Math.abs(new Date(m.created_at).getTime() - new Date(newMsg.created_at).getTime()) < 5000 // Within 5 seconds
            );
            
            if (optimisticIndex !== -1) {
              // Replace optimistic message with real one
              return prev.map((m, idx) => 
                idx === optimisticIndex
                  ? {
                      id: newMsg.id,
                      content: newMsg.content,
                      user_id: newMsg.sender_id,
                      created_at: newMsg.created_at,
                    }
                  : m
              );
            }
            
            // New message - append it
            return [...prev, {
              id: newMsg.id,
              content: newMsg.content,
              user_id: newMsg.sender_id,
              created_at: newMsg.created_at,
            }];
          });

          // Auto-scroll if user is at bottom
          if (isUserAtBottomRef.current) {
            setTimeout(() => {
              scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 50);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [invitationId, currentUserId, selectedUser, setTyping]);

  // Smart auto-scroll - only scroll if user is at bottom
  useEffect(() => {
    if (isUserAtBottomRef.current && messages.length > 0) {
      const timer = setTimeout(() => {
        scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [messages]);

  // Track scroll position to determine if user is at bottom
  useEffect(() => {
    if (!selectedUser || !scrollAreaRef.current) return;

    // Find the viewport element inside ScrollArea
    const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
    if (!viewport) return;

    const handleScroll = () => {
      const isAtBottom = 
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 100; // 100px threshold
      isUserAtBottomRef.current = isAtBottom;
    };

    viewport.addEventListener('scroll', handleScroll);
    
    // Check initial position
    handleScroll();

    return () => {
      viewport.removeEventListener('scroll', handleScroll);
    };
  }, [selectedUser]);

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

    // Generate temporary ID for optimistic update
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const optimisticMessage: ChatMessage = {
      id: tempId,
      content: trimmedMessage,
      user_id: currentUserId,
      created_at: new Date().toISOString(),
      isOptimistic: true,
    };

    // Optimistically add message immediately
    setMessages(prev => [...prev, optimisticMessage]);
    setNewMessage('');
    setSending(true);
    // Clear typing indicator when we send a message
    setTyping(false);

    // Scroll to bottom immediately for instant feedback
    setTimeout(() => {
      scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);

    // Send to Supabase
    const { data, error } = await supabase
      .from('direct_messages')
      .insert({
        invitation_id: invitationId,
        sender_id: currentUserId,
        content: trimmedMessage,
      })
      .select('id, content, sender_id, created_at')
      .single();

    setSending(false);

    if (error) {
      // Rollback optimistic update on error
      setMessages(prev => prev.filter(m => m.id !== tempId));
      
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
        // Restore message to input so user can retry
        setNewMessage(trimmedMessage);
      }
    } else if (data) {
      // Replace optimistic message with real one (in case realtime didn't fire or hasn't fired yet)
      setMessages(prev => {
        const hasOptimistic = prev.some(m => m.id === tempId);
        if (!hasOptimistic) {
          // Realtime may have already processed it, check if real message exists
          const hasReal = prev.some(m => m.id === data.id);
          if (hasReal) {
            // Already exists from realtime, no need to add
            return prev;
          }
          // Neither exists, add it (shouldn't happen, but safe fallback)
          return [...prev, {
            id: data.id,
            content: data.content,
            user_id: data.sender_id,
            created_at: data.created_at,
          }];
        }
        // Replace optimistic with real
        return prev.map(m => 
          m.id === tempId 
            ? {
                id: data.id,
                content: data.content,
                user_id: data.sender_id,
                created_at: data.created_at,
              }
            : m
        );
      });
    }
  };

  const handleSelectConversation = (item: ConversationItem) => {
    if (item.type === 'dm' && item.userId) {
      setSelectedUser(item.userId);
      setMessages([]);
      // Reset scroll position tracking when switching conversations
      isUserAtBottomRef.current = true;
      
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

    // No toast here - user knows they accepted it, they clicked the button
    // The sender will get notified via realtime listener

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

  const hasUnread = getTotalUnreadCount() > 0;
  const showRedDot = pendingCount > 0 || hasUnread;
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
      {showRedDot && (
        <span className={`absolute -top-0.5 -right-0.5 z-10 w-3 h-3 rounded-full ${
          pendingCount > 0 
            ? 'bg-warning animate-pulse' 
            : 'bg-destructive'
        }`} />
      )}
    </Button>
  );

  if (!isOpen) {
    return triggerButton;
  }

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center" style={{ isolation: 'isolate' }}>
      {/* Backdrop - hidden on mobile since full-screen */}
      <div
        className="absolute inset-0 bg-transparent hidden md:block"
        onClick={handleClose}
      />

      {/* Modal - Full screen on mobile, card on desktop */}
      <div className="relative bg-card md:border-2 md:border-border md:rounded-2xl md:shadow-hard w-screen h-dvh md:w-full md:max-w-md md:max-h-[85vh] md:h-auto flex flex-col animate-in slide-in-from-bottom-4 md:fade-in duration-300 z-10">
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
            <ScrollArea ref={scrollAreaRef} className="flex-1 overflow-auto">
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
                {isOtherUserTyping && (
                  <TypingIndicator userName={selectedUserData?.nick} />
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
                    onChange={(e) => {
                      const value = e.target.value.slice(0, MAX_MESSAGE_LENGTH);
                      setNewMessage(value);
                      setTyping(value.length > 0);
                    }}
                    onBlur={() => setTyping(false)}
                    placeholder="Type a message..."
                    className="flex-1 bg-muted/50 border-border"
                    maxLength={MAX_MESSAGE_LENGTH}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                  />
                  <Button
                    size="icon"
                    onClick={handleSendMessage}
                    disabled={sending || !newMessage.trim()}
                    className="shrink-0"
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
