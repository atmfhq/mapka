import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Send, Radio } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface ChatMessage {
  id: string;
  event_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: {
    nick: string | null;
    avatar_url: string | null;
  };
}

interface LobbyChatMessagesProps {
  eventId: string;
  currentUserId: string;
}

const LobbyChatMessages = ({ eventId, currentUserId }: LobbyChatMessagesProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch initial messages
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
        // Fetch profiles for all messages
        const userIds = [...new Set(data.map(m => m.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, nick, avatar_url')
          .in('id', userIds);

        const messagesWithProfiles = data.map(msg => ({
          ...msg,
          profile: profiles?.find(p => p.id === msg.user_id),
        }));

        setMessages(messagesWithProfiles);
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
          
          // Fetch profile for new message
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, nick, avatar_url')
            .eq('id', newMsg.user_id)
            .maybeSingle();

          setMessages(prev => [...prev, { ...newMsg, profile: profile || undefined }]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    setSending(true);

    const { error } = await supabase.from('event_chat_messages').insert({
      event_id: eventId,
      user_id: currentUserId,
      content: newMessage.trim(),
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

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Radio className="w-4 h-4 text-primary animate-pulse" />
        <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Tactical Comms
        </h4>
      </div>

      {/* Messages */}
      <ScrollArea className="h-48 rounded-lg bg-background/50 border border-border/50 p-3">
        <div ref={scrollRef} className="space-y-2">
          {messages.length === 0 ? (
            <p className="text-center text-muted-foreground text-xs py-4">
              No messages yet. Start the tactical comms.
            </p>
          ) : (
            messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`text-sm font-mono ${
                  msg.user_id === currentUserId 
                    ? 'text-primary' 
                    : 'text-foreground'
                }`}
              >
                <span className="text-warning font-semibold">
                  {msg.profile?.nick || 'UNKNOWN'}
                </span>
                <span className="text-muted-foreground mx-1">
                  [{format(new Date(msg.created_at), 'HH:mm')}]:
                </span>
                <span className="text-foreground/90">{msg.content}</span>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="flex gap-2">
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type message..."
          className="flex-1 bg-background/50 border-border/50 font-mono text-sm"
          disabled={sending}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={sending || !newMessage.trim()}
          className="bg-primary hover:bg-primary/90"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default LobbyChatMessages;
