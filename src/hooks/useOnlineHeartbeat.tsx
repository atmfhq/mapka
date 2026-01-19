import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const HEARTBEAT_INTERVAL = 30_000; // 30 seconds

/**
 * Hook to maintain online presence via periodic heartbeats.
 * Sends heartbeat every 30 seconds to update last_seen timestamp.
 * Server-side cleanup marks users offline after 2 minutes of no heartbeat.
 */
export const useOnlineHeartbeat = (userId: string | null) => {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isActiveRef = useRef(true);

  useEffect(() => {
    if (!userId) return;

    const sendHeartbeat = async () => {
      // Don't send heartbeat if tab is hidden (save resources)
      if (document.visibilityState === 'hidden' || !isActiveRef.current) {
        return;
      }

      try {
        const { error } = await supabase.rpc('mark_user_online', { p_user_id: userId });
        if (error) {
          // RPC function might not exist yet (migration not applied) - this is OK
          // Don't spam console with these warnings
        } else {
          console.log('[Heartbeat] Sent heartbeat for user:', userId);
        }
      } catch (err) {
        console.error('[Heartbeat] Error sending heartbeat:', err);
      }
    };

    // Handle visibility changes - resume heartbeat when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isActiveRef.current) {
        // Send immediate heartbeat when tab becomes visible
        sendHeartbeat();
      }
    };

    // Send initial heartbeat on mount
    sendHeartbeat();

    // Set up periodic heartbeat
    intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isActiveRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [userId]);
};
