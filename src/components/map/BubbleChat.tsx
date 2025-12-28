import { useState, useRef, useEffect, useCallback } from 'react';
import { Send } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { REALTIME_CHANNEL } from '@/hooks/useProfilesRealtime';

const CHAT_EVENT = 'chat-message';
const MAX_MESSAGE_LENGTH = 60;
const BUBBLE_DURATION_MS = 7000;

export interface ChatBubblePayload {
  user_id: string;
  message: string;
  timestamp: string;
}

export interface ActiveBubble {
  userId: string;
  message: string;
  expiresAt: number;
}

interface BubbleChatProps {
  currentUserId: string | null;
  isGuest?: boolean;
  onBubbleReceived?: (bubble: ActiveBubble) => void;
}

const BubbleChat = ({ currentUserId, isGuest = false, onBubbleReceived }: BubbleChatProps) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Subscribe to chat messages on the global channel
  useEffect(() => {
    console.log('[BubbleChat] Setting up chat-message listener on', REALTIME_CHANNEL);

    const channel = supabase
      .channel(`${REALTIME_CHANNEL}-chat`)
      .on('broadcast', { event: CHAT_EVENT }, (raw) => {
        const payload: ChatBubblePayload | undefined = raw?.payload;
        if (!payload) return;

        console.log('[BubbleChat] Received chat message:', payload);

        // Create active bubble (including own messages for consistency)
        const bubble: ActiveBubble = {
          userId: payload.user_id,
          message: payload.message,
          expiresAt: Date.now() + BUBBLE_DURATION_MS,
        };

        onBubbleReceived?.(bubble);
      })
      .subscribe((status) => {
        console.log('[BubbleChat] Chat subscription status:', status);
      });

    channelRef.current = channel;

    return () => {
      console.log('[BubbleChat] Cleaning up chat subscription');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [onBubbleReceived]);

  const handleSend = useCallback(async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || !currentUserId || isGuest) return;

    setSending(true);

    try {
      // Create a dedicated channel for sending
      const sendChannel = supabase.channel(`${REALTIME_CHANNEL}-chat-send`);

      const payload: ChatBubblePayload = {
        user_id: currentUserId,
        message: trimmedMessage.slice(0, MAX_MESSAGE_LENGTH),
        timestamp: new Date().toISOString(),
      };

      await sendChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          sendChannel.send({ type: 'broadcast', event: CHAT_EVENT, payload });

          // Also show our own bubble immediately
          onBubbleReceived?.({
            userId: currentUserId,
            message: trimmedMessage.slice(0, MAX_MESSAGE_LENGTH),
            expiresAt: Date.now() + BUBBLE_DURATION_MS,
          });

          // Cleanup after sending
          setTimeout(() => {
            supabase.removeChannel(sendChannel);
          }, 500);
        }
      });

      setMessage('');
    } catch (err) {
      console.error('[BubbleChat] Failed to send message:', err);
    } finally {
      setSending(false);
    }
  }, [message, currentUserId, isGuest, onBubbleReceived]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Don't show input for guests
  if (isGuest || !currentUserId) {
    return null;
  }

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
      <div className="flex items-center gap-2 bg-card/90 backdrop-blur-md border border-border/50 rounded-full px-3 py-2 shadow-lg">
        <Input
          ref={inputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
          onKeyDown={handleKeyDown}
          placeholder="Say something..."
          className="w-48 sm:w-64 bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 text-sm placeholder:text-muted-foreground/60"
          maxLength={MAX_MESSAGE_LENGTH}
          disabled={sending}
        />
        <span className="text-[10px] text-muted-foreground/50 font-mono">
          {message.length}/{MAX_MESSAGE_LENGTH}
        </span>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleSend}
          disabled={sending || !message.trim()}
          className="h-8 w-8 rounded-full bg-primary/20 hover:bg-primary/30 text-primary"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default BubbleChat;
