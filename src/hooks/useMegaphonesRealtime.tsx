import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getOrCreateChannel, safeRemoveChannel } from '@/lib/realtimeUtils';

interface UseMegaphonesRealtimeOptions {
  enabled?: boolean;
  onInsert?: (megaphone: any) => void;
  onUpdate?: (megaphone: any) => void;
  onDelete?: (megaphoneId: string) => void;
}

/**
 * Hook to subscribe to realtime changes on the megaphones table.
 * Uses refs to avoid resubscribing when callbacks change.
 */
export const useMegaphonesRealtime = ({
  enabled = true,
  onInsert,
  onUpdate,
  onDelete,
}: UseMegaphonesRealtimeOptions) => {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  
  // Use refs to avoid resubscribing when callbacks change
  const enabledRef = useRef(enabled);
  const onInsertRef = useRef(onInsert);
  const onUpdateRef = useRef(onUpdate);
  const onDeleteRef = useRef(onDelete);

  // Keep refs in sync
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => { onInsertRef.current = onInsert; }, [onInsert]);
  useEffect(() => { onUpdateRef.current = onUpdate; }, [onUpdate]);
  useEffect(() => { onDeleteRef.current = onDelete; }, [onDelete]);

  // Subscribe once on mount, clean up on unmount
  useEffect(() => {
    if (!enabledRef.current) {
      return;
    }

    const channelName = 'megaphones-realtime';
    
    // Check if channel already exists to prevent CHANNEL_ERROR
    const { channel, shouldSubscribe } = getOrCreateChannel(channelName);
    
    if (!shouldSubscribe) {
      console.log('[MegaphonesRealtime] Channel already subscribed:', channelName);
      channelRef.current = channel;
      return;
    }
    
    channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'megaphones' },
        (payload) => {
          console.log('[MegaphonesRealtime] 🔔 Realtime Event Received - INSERT:', payload.new?.id);
          onInsertRef.current?.(payload.new);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'megaphones' },
        (payload) => {
          console.log('[MegaphonesRealtime] 🔔 Realtime Event Received - UPDATE:', payload.new?.id);
          onUpdateRef.current?.(payload.new);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'megaphones' },
        (payload) => {
          const deletedId = (payload.old as any)?.id;
          console.log('[MegaphonesRealtime] 🔔 Realtime Event Received - DELETE:', deletedId);
          if (deletedId) {
            onDeleteRef.current?.(deletedId);
          }
        }
      )
    channel.subscribe((status) => {
      console.log('[MegaphonesRealtime] 📡 Channel subscription status:', status);
      if (status === 'SUBSCRIBED') {
        console.log('[MegaphonesRealtime] ✅ Successfully subscribed to realtime');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[MegaphonesRealtime] ❌ Channel subscription error');
      }
    });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        safeRemoveChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []); // Empty deps - subscribe once
};
