import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Send } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import AvatarDisplay from '@/components/avatar/AvatarDisplay';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

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

interface LobbyChatMessagesProps {
  eventId: string;
  currentUserId: string;
}

const MAX_MESSAGE_LENGTH = 2000;

const LobbyChatMessages = ({ eventId, currentUserId }: LobbyChatMessagesProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [userJoinedAt, setUserJoinedAt] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch user's joined_at timestamp for this event
  useEffect(() => {
    const fetchJoinedAt = async () => {
      // First check if user is a participant
      const { data: participation } = await supabase
        .from('event_participants')
        .select('joined_at')
        .eq('event_id', eventId)
        .eq('user_id', currentUserId)
        .maybeSingle();
      
      if (participation?.joined_at) {
        setUserJoinedAt(participation.joined_at);
        return;
      }
      
      // If not a participant, check if user is the host (use megaphone created_at as join time)
      const { data: megaphone } = await supabase
        .from('megaphones')
        .select('host_id, created_at')
        .eq('id', eventId)
        .eq('host_id', currentUserId)
        .maybeSingle();
      
      if (megaphone?.created_at) {
        setUserJoinedAt(megaphone.created_at);
      }
    };

    fetchJoinedAt();
  }, [eventId, currentUserId]);

  // Fetch initial messages (filtered by joined_at)
  useEffect(() => {
    const fetchMessages = async () => {
      // Don't fetch until we know the user's join timestamp
      if (!userJoinedAt) return;

      let query = supabase
        .from('event_chat_messages')
        .select('id, event_id, user_id, content, created_at')
        .eq('event_id', eventId)
        .gte('created_at', userJoinedAt) // Only messages after user joined
        .order('created_at', { ascending: true });

      const { data, error } = await query;

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
  }, [eventId, userJoinedAt]);

  // Subscribe to realtime updates
  useEffect(() => {
    // Don't subscribe until we know the user's join timestamp
    if (!userJoinedAt) return;

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
          
          // Only add message if it's after user joined
          if (new Date(newMsg.created_at) < new Date(userJoinedAt)) {
            return;
          }
          
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
  }, [eventId, userJoinedAt]);

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
      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0 pr-2">
        <div className="space-y-4 py-2">
          {messages.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">
              No messages yet. Start the conversation!
            </p>
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
                      <div
                        key={msg.id}
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
