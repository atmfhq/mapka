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

    const channel = supabase
      .channel('megaphones-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'megaphones' },
        (payload) => {
          onInsertRef.current?.(payload.new);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'megaphones' },
        (payload) => {
          onUpdateRef.current?.(payload.new);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'megaphones' },
        (payload) => {
          const deletedId = (payload.old as any)?.id;
          if (deletedId) {
            onDeleteRef.current?.(deletedId);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []); // Empty deps - subscribe once
};
