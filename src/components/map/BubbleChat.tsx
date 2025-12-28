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
  const [cooldown, setCooldown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const sendChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Create a persistent send channel on mount
  useEffect(() => {
    if (!currentUserId || isGuest) return;

    // Use the EXACT same channel name - Supabase will reuse if exists
    const channel = supabase.channel(REALTIME_CHANNEL);
    
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[BubbleChat] Send channel ready on', REALTIME_CHANNEL);
      }
    });

    sendChannelRef.current = channel;

    return () => {
      // Don't remove the channel - it's shared with useProfilesRealtime
      sendChannelRef.current = null;
    };
  }, [currentUserId, isGuest]);

  // Keep input focused after cooldown ends
  useEffect(() => {
    if (!cooldown && inputRef.current) {
      inputRef.current.focus();
    }
  }, [cooldown]);

  const handleSend = useCallback(async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || !currentUserId || isGuest || cooldown) return;

    // Clear input FIRST for instant feedback
    setMessage('');
    
    // Start cooldown immediately
    setCooldown(true);

    const payload: ChatBubblePayload = {
      user_id: currentUserId,
      message: trimmedMessage.slice(0, MAX_MESSAGE_LENGTH),
      timestamp: new Date().toISOString(),
    };

    // Show our own bubble immediately
    onLocalBubble?.({
      userId: currentUserId,
      message: trimmedMessage.slice(0, MAX_MESSAGE_LENGTH),
      expiresAt: Date.now() + BUBBLE_DURATION_MS,
    });

    // Send via the shared channel
    if (sendChannelRef.current) {
      console.log('💬 SENDING Chat bubble to', REALTIME_CHANNEL, payload);
      sendChannelRef.current.send({ type: 'broadcast', event: CHAT_EVENT, payload });
    } else {
      console.warn('[BubbleChat] No send channel available');
    }

    // End cooldown after delay
    setTimeout(() => {
      setCooldown(false);
    }, COOLDOWN_MS);
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

  const isDisabled = cooldown;

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
