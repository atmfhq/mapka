import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseMegaphonesRealtimeOptions {
  enabled?: boolean;
  onInsert?: (megaphone: any) => void;
  onUpdate?: (megaphone: any) => void;
  onDelete?: (megaphoneId: string) => void;
}

/**
 * Hook to subscribe to realtime changes on the megaphones table.
 * Enables live map synchronization for quests.
 */
export const useMegaphonesRealtime = ({
  enabled = true,
  onInsert,
  onUpdate,
  onDelete,
}: UseMegaphonesRealtimeOptions) => {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!enabled) {
      console.log('[Megaphones Realtime] Disabled, skipping subscription');
      return;
    }

    console.log('[Megaphones Realtime] Setting up subscription...');

    const channel = supabase
      .channel('megaphones-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'megaphones',
        },
        (payload) => {
          console.log('[Megaphones Realtime] INSERT received:', payload.new);
          onInsert?.(payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'megaphones',
        },
        (payload) => {
          console.log('[Megaphones Realtime] UPDATE received:', payload.new);
          onUpdate?.(payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'megaphones',
        },
        (payload) => {
          console.log('[Megaphones Realtime] DELETE received:', payload.old);
          // For DELETE, payload.old contains the deleted row
          const deletedId = (payload.old as any)?.id;
          if (deletedId) {
            onDelete?.(deletedId);
          }
        }
      )
      .subscribe((status) => {
        console.log('[Megaphones Realtime] Subscription status:', status);
      });

    channelRef.current = channel;

    return () => {
      console.log('[Megaphones Realtime] Cleaning up subscription');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, onInsert, onUpdate, onDelete]);
};
