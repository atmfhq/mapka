import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TypingState {
  [userId: string]: boolean;
}

export function useTypingPresence(
  invitationId: string | null,
  currentUserId: string,
  otherUserId: string | null
) {
  const [typingUsers, setTypingUsers] = useState<TypingState>({});
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingRef = useRef<number>(0);

  // Check if other user is typing
  const isOtherUserTyping = otherUserId ? typingUsers[otherUserId] === true : false;

  // Broadcast typing status (debounced)
  const setTyping = useCallback((isTyping: boolean) => {
    if (!channelRef.current || !currentUserId) return;

    const now = Date.now();
    // Throttle typing events to max 1 per 500ms
    if (isTyping && now - lastTypingRef.current < 500) return;
    lastTypingRef.current = now;

    channelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: currentUserId, isTyping },
    });
  }, [currentUserId]);

  // Setup presence channel
  useEffect(() => {
    if (!invitationId || !currentUserId) {
      setTypingUsers({});
      return;
    }

    const channelName = `typing-${invitationId}`;
    const channel = supabase.channel(channelName);

    channel
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { userId, isTyping } = payload.payload as { userId: string; isTyping: boolean };
        
        if (userId === currentUserId) return; // Ignore own typing events

        setTypingUsers(prev => ({
          ...prev,
          [userId]: isTyping,
        }));

        // Auto-clear typing after 3 seconds if no update
        if (isTyping) {
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }
          typingTimeoutRef.current = setTimeout(() => {
            setTypingUsers(prev => ({
              ...prev,
              [userId]: false,
            }));
          }, 3000);
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [invitationId, currentUserId]);

  // Clear typing when unmounting or changing chats
  useEffect(() => {
    return () => {
      setTyping(false);
    };
  }, [setTyping, invitationId]);

  return {
    isOtherUserTyping,
    setTyping,
  };
}
