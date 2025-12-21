import { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { MessageCircle, User, X, Send, ChevronLeft, Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useConnectedUsers } from '@/hooks/useConnectedUsers';

interface ChatMessage {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
}

interface ChatDrawerProps {
  currentUserId: string;
  externalOpen?: boolean;
  externalUserId?: string | null;
  onOpenChange?: (open: boolean) => void;
}

const ChatDrawer = ({ currentUserId, externalOpen, externalUserId, onOpenChange }: ChatDrawerProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { connectedUsers, disconnectUser, getMissionIdForUser, loading } = useConnectedUsers(currentUserId);

  // Use external open state if provided
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = (value: boolean) => {
    setInternalOpen(value);
    onOpenChange?.(value);
  };

  // Handle external user selection (from map click)
  useEffect(() => {
    if (externalUserId && externalOpen) {
      console.log('ChatDrawer: Opening for external user:', externalUserId);
      setSelectedUser(externalUserId);
    }
  }, [externalUserId, externalOpen]);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setSelectedUser(null);
      setMessages([]);
    }
  };

  const selectedUserData = connectedUsers.find(u => u.id === selectedUser);
  const missionId = selectedUser ? getMissionIdForUser(selectedUser) : null;

  console.log('ChatDrawer state:', { 
    selectedUser, 
    missionId, 
    connectedUsers: connectedUsers.length,
    selectedUserData 
  });

  // Fetch messages for the mission
  const fetchMessages = useCallback(async () => {
    if (!missionId) {
      console.log('ChatDrawer: No missionId, skipping message fetch');
      return;
    }

    setLoadingMessages(true);
    console.log('ChatDrawer: Fetching messages for mission:', missionId);

    const { data, error } = await supabase
      .from('event_chat_messages')
      .select('id, content, user_id, created_at')
      .eq('event_id', missionId)
      .order('created_at', { ascending: true });

    console.log('ChatDrawer: Messages fetched:', data, 'Error:', error);

    if (data) {
      setMessages(data);
    }
    setLoadingMessages(false);
  }, [missionId]);

  useEffect(() => {
    if (selectedUser && missionId) {
      fetchMessages();
    }
  }, [selectedUser, missionId, fetchMessages]);

  // Realtime subscription for messages
  useEffect(() => {
    if (!missionId) return;

    const channel = supabase
      .channel(`chat-${missionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'event_chat_messages',
          filter: `event_id=eq.${missionId}`,
        },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [missionId, fetchMessages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !missionId) {
      console.log('ChatDrawer: Cannot send - no message or no missionId');
      return;
    }

    setSending(true);
    const { error } = await supabase.from('event_chat_messages').insert({
      event_id: missionId,
      user_id: currentUserId,
      content: newMessage.trim(),
    });

    setSending(false);
    if (error) {
      console.error('ChatDrawer: Send error:', error);
      toast({
        title: 'Failed to send message',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setNewMessage('');
    }
  };

  const handleDisconnect = async () => {
    const user = connectedUsers.find(u => u.id === selectedUser);
    if (!user) return;

    const { error } = await disconnectUser(user.invitationId);
    if (error) {
      toast({
        title: 'Failed to disconnect',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Connection terminated' });
      setSelectedUser(null);
    }
  };

  const handleSelectUser = (userId: string) => {
    console.log('ChatDrawer: Selecting user:', userId);
    setSelectedUser(userId);
    setMessages([]);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative min-w-[44px] min-h-[44px] text-muted-foreground hover:text-foreground"
        >
          <MessageCircle className="w-5 h-5" />
          {connectedUsers.length > 0 && (
            <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-success text-success-foreground text-xs font-bold flex items-center justify-center">
              {connectedUsers.length}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh]">
        <SheetHeader>
          <SheetTitle className="font-orbitron text-xl flex items-center gap-2">
            {selectedUser ? (
              <>
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
                <Avatar className="w-8 h-8 border-2 border-success">
                  <AvatarImage src={selectedUserData?.avatar_url || undefined} />
                  <AvatarFallback className="bg-success/20 text-success">
                    {selectedUserData?.nick?.[0]?.toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                <span>{selectedUserData?.nick || 'Unknown'}</span>
              </>
            ) : (
              <>
                <MessageCircle className="w-5 h-5 text-success" />
                Active Connections
              </>
            )}
          </SheetTitle>
        </SheetHeader>

        {!selectedUser ? (
          // Connection list
          <ScrollArea className="h-[60vh] mt-4">
            <div className="space-y-2">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : connectedUsers.length === 0 ? (
                <div className="text-center py-12">
                  <MessageCircle className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground text-sm">No active connections</p>
                  <p className="text-muted-foreground/60 text-xs mt-1">
                    Signal operatives on the map to connect
                  </p>
                </div>
              ) : (
                connectedUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleSelectUser(user.id)}
                    className="w-full p-3 rounded-lg bg-success/10 border border-success/30 hover:border-success/60 transition-colors flex items-center gap-3"
                  >
                    <Avatar className="w-12 h-12 border-2 border-success">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback className="bg-success/20 text-success">
                        {user.nick?.[0]?.toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left">
                      <p className="font-semibold">{user.nick || 'Unknown'}</p>
                      <p className="text-xs text-success">Connected</p>
                    </div>
                    <Badge variant="outline" className="bg-success/20 text-success border-success/40">
                      Active
                    </Badge>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        ) : (
          // Chat view
          <div className="flex flex-col h-[60vh] mt-4">
            {/* Messages */}
            <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
              <div className="space-y-3">
                {loadingMessages ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : !missionId ? (
                  <p className="text-center text-muted-foreground text-sm py-8">
                    No shared mission found. Accept an invitation to start chatting.
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

            {/* Input */}
            {missionId && (
              <div className="flex gap-2 mt-4 pt-4 border-t border-border/50">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1"
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

            {/* Actions */}
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => {
                  toast({ title: 'Profile view coming soon' });
                }}
              >
                <User className="w-4 h-4" />
                View Profile
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-2 border-destructive/50 text-destructive hover:bg-destructive/10"
                onClick={handleDisconnect}
              >
                <X className="w-4 h-4" />
                Disconnect
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default ChatDrawer;
