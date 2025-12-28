import { useState, useRef, useCallback, useEffect } from 'react';
import { Send } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

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
  onSendMessage?: (message: string) => void;
}

const BubbleChat = ({ currentUserId, isGuest = false, onLocalBubble, onSendMessage }: BubbleChatProps) => {
  const [message, setMessage] = useState('');
  const [cooldown, setCooldown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Use refs to avoid stale closures in callbacks
  const messageRef = useRef(message);
  const cooldownRef = useRef(cooldown);
  const onLocalBubbleRef = useRef(onLocalBubble);
  const onSendMessageRef = useRef(onSendMessage);
  
  // Keep refs in sync
  useEffect(() => { messageRef.current = message; }, [message]);
  useEffect(() => { cooldownRef.current = cooldown; }, [cooldown]);
  useEffect(() => { onLocalBubbleRef.current = onLocalBubble; }, [onLocalBubble]);
  useEffect(() => { onSendMessageRef.current = onSendMessage; }, [onSendMessage]);

  // Keep input focused after cooldown ends
  useEffect(() => {
    if (!cooldown && inputRef.current) {
      inputRef.current.focus();
    }
  }, [cooldown]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
      }
    };
  }, []);

  // Stable send function that uses refs - won't go stale
  const handleSend = useCallback(() => {
    const currentMessage = messageRef.current.trim();
    const inCooldown = cooldownRef.current;
    
    console.log('[BubbleChat] handleSend called', { 
      message: currentMessage, 
      currentUserId, 
      isGuest, 
      cooldown: inCooldown,
      hasOnSendMessage: !!onSendMessageRef.current 
    });
    
    if (!currentMessage) {
      console.log('[BubbleChat] Empty message, skipping');
      return;
    }
    if (!currentUserId) {
      console.log('[BubbleChat] No currentUserId, skipping');
      return;
    }
    if (isGuest) {
      console.log('[BubbleChat] Is guest, skipping');
      return;
    }
    if (inCooldown) {
      console.log('[BubbleChat] In cooldown, skipping');
      return;
    }

    const finalMessage = currentMessage.slice(0, MAX_MESSAGE_LENGTH);

    // Clear input FIRST for instant feedback
    setMessage('');
    
    // Clear any existing cooldown timer
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
    }
    
    // Start cooldown immediately
    setCooldown(true);

    // Show our own bubble immediately
    console.log('[BubbleChat] Showing local bubble');
    onLocalBubbleRef.current?.({
      userId: currentUserId,
      message: finalMessage,
      expiresAt: Date.now() + BUBBLE_DURATION_MS,
    });

    // Send via the shared channel (passed from parent)
    console.log('[BubbleChat] Calling onSendMessage');
    onSendMessageRef.current?.(finalMessage);

    // End cooldown after delay
    cooldownTimerRef.current = setTimeout(() => {
      console.log('[BubbleChat] Cooldown ended');
      setCooldown(false);
      cooldownTimerRef.current = null;
    }, COOLDOWN_MS);
  }, [currentUserId, isGuest]); // Only stable deps - refs handle the rest

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      console.log('[BubbleChat] Enter key pressed');
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Don't show input for guests
  if (isGuest || !currentUserId) {
    return null;
  }

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
          disabled={cooldown}
          autoComplete="off"
        />
        <span className="text-[10px] text-muted-foreground/50 font-mono">
          {message.length}/{MAX_MESSAGE_LENGTH}
        </span>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleSend}
          disabled={cooldown || !message.trim()}
          className="h-8 w-8 rounded-full bg-primary/20 hover:bg-primary/30 text-primary disabled:opacity-40"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default BubbleChat;
