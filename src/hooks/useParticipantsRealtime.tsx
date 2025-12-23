import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseParticipantsRealtimeOptions {
  enabled?: boolean;
  onJoin?: (eventId: string, userId: string) => void;
  onLeave?: (eventId: string, userId: string) => void;
}

/**
 * Hook to subscribe to realtime changes on the event_participants table.
 * Enables live visual feedback when users join or leave quests.
 */
export const useParticipantsRealtime = ({
  enabled = true,
  onJoin,
  onLeave,
}: UseParticipantsRealtimeOptions) => {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!enabled) {
      console.log('[Participants Realtime] Disabled, skipping subscription');
      return;
    }

    console.log('[Participants Realtime] Setting up subscription...');

    const channel = supabase
      .channel('participants-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'event_participants',
        },
        (payload) => {
          const newParticipant = payload.new as any;
          console.log('[Participants Realtime] User joined quest:', {
            eventId: newParticipant.event_id,
            userId: newParticipant.user_id,
            status: newParticipant.status,
          });
          if (newParticipant.status === 'joined') {
            onJoin?.(newParticipant.event_id, newParticipant.user_id);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'event_participants',
        },
        (payload) => {
          const updated = payload.new as any;
          const old = payload.old as any;
          console.log('[Participants Realtime] Participation updated:', {
            eventId: updated.event_id,
            userId: updated.user_id,
            oldStatus: old?.status,
            newStatus: updated.status,
          });
          // User just joined (status changed to 'joined')
          if (updated.status === 'joined' && old?.status !== 'joined') {
            onJoin?.(updated.event_id, updated.user_id);
          }
          // User left (status changed from 'joined' to something else)
          if (updated.status !== 'joined' && old?.status === 'joined') {
            onLeave?.(updated.event_id, updated.user_id);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'event_participants',
        },
        (payload) => {
          const deleted = payload.old as any;
          console.log('[Participants Realtime] User left quest:', {
            eventId: deleted?.event_id,
            userId: deleted?.user_id,
          });
          if (deleted?.event_id && deleted?.user_id) {
            onLeave?.(deleted.event_id, deleted.user_id);
          }
        }
      )
      .subscribe((status) => {
        console.log('[Participants Realtime] Subscription status:', status);
      });

    channelRef.current = channel;

    return () => {
      console.log('[Participants Realtime] Cleaning up subscription');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, onJoin, onLeave]);
};
