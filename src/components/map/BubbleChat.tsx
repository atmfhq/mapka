import { useState, useRef, useCallback, useEffect } from 'react';
import { Send } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { REALTIME_CHANNEL, CHAT_EVENT, ChatBubblePayload } from '@/hooks/useProfilesRealtime';

const MAX_MESSAGE_LENGTH = 60;
const BUBBLE_DURATION_MS = 7000;
const COOLDOWN_MS = 1500;

export interface ActiveBubble {
  userId: string;
  message: string;
  expiresAt: number;
}

interface BubbleChatProps {
  currentUserId: string | null;
  isGuest?: boolean;
  onLocalBubble?: (bubble: ActiveBubble) => void;
}

const BubbleChat = ({ currentUserId, isGuest = false, onLocalBubble }: BubbleChatProps) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep input focused after operations
  useEffect(() => {
    if (!cooldown && !sending && inputRef.current) {
      inputRef.current.focus();
    }
  }, [cooldown, sending]);

  const handleSend = useCallback(async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || !currentUserId || isGuest || cooldown) return;

    setSending(true);
    setCooldown(true);

    try {
      const payload: ChatBubblePayload = {
        user_id: currentUserId,
        message: trimmedMessage.slice(0, MAX_MESSAGE_LENGTH),
        timestamp: new Date().toISOString(),
      };

      // Show our own bubble immediately for instant feedback
      onLocalBubble?.({
        userId: currentUserId,
        message: trimmedMessage.slice(0, MAX_MESSAGE_LENGTH),
        expiresAt: Date.now() + BUBBLE_DURATION_MS,
      });

      // Send via the SAME channel everyone is subscribed to
      const sendChannel = supabase.channel(`${REALTIME_CHANNEL}-send-${Date.now()}`);

      await sendChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('💬 SENDING Chat bubble to', REALTIME_CHANNEL, payload);
          sendChannel.send({ type: 'broadcast', event: CHAT_EVENT, payload });

          // Cleanup after sending
          setTimeout(() => {
            supabase.removeChannel(sendChannel);
          }, 500);
        }
      });

      // Clear input immediately
      setMessage('');
    } catch (err) {
      console.error('[BubbleChat] Failed to send message:', err);
    } finally {
      setSending(false);
      
      // Start cooldown timer
      setTimeout(() => {
        setCooldown(false);
      }, COOLDOWN_MS);
    }
  }, [message, currentUserId, isGuest, cooldown, onLocalBubble]);

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

  const isDisabled = sending || cooldown;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
      <div 
        className={`flex items-center gap-2 bg-card/90 backdrop-blur-md border border-border/50 rounded-full px-3 py-2 shadow-lg transition-opacity duration-200 ${
          cooldown ? 'opacity-60' : 'opacity-100'
        }`}
      >
        <Input
          ref={inputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
          onKeyDown={handleKeyDown}
          placeholder={cooldown ? "Wait..." : "Say something..."}
          className="w-48 sm:w-64 bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 text-sm placeholder:text-muted-foreground/60"
          maxLength={MAX_MESSAGE_LENGTH}
          disabled={isDisabled}
          autoComplete="off"
        />
        <span className="text-[10px] text-muted-foreground/50 font-mono">
          {message.length}/{MAX_MESSAGE_LENGTH}
        </span>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleSend}
          disabled={isDisabled || !message.trim()}
          className="h-8 w-8 rounded-full bg-primary/20 hover:bg-primary/30 text-primary disabled:opacity-40"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default BubbleChat;
