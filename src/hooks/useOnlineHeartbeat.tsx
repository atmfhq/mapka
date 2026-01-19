import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const HEARTBEAT_INTERVAL = 30_000; // 30 seconds

/**
 * Hook to maintain online presence via periodic heartbeats.
 * Sends heartbeat every 30 seconds to update last_seen timestamp.
 * Server-side cleanup marks users offline after 2 minutes of no heartbeat.
 * Also handles browser close/tab hide via Beacon API.
 */
export const useOnlineHeartbeat = (userId: string | null) => {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isActiveRef = useRef(true);
  const userIdRef = useRef<string | null>(null);

  // Keep userIdRef in sync for use in event handlers
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

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

    // Send offline beacon using fetch with keepalive (works even when page is closing)
    const sendOfflineBeacon = () => {
      const currentUserId = userIdRef.current;
      if (!currentUserId) return;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      if (!supabaseUrl || !supabaseKey) return;

      // Use fetch with keepalive to ensure request completes even after page unloads
      fetch(`${supabaseUrl}/rest/v1/rpc/mark_user_offline`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ p_user_id: currentUserId }),
        keepalive: true,
      }).catch(() => {
        // Ignore errors - we're leaving the page anyway
      });

      console.log('[Heartbeat] Sent offline beacon for user:', currentUserId);
    };

    // Handle visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isActiveRef.current) {
        // Send immediate heartbeat when tab becomes visible
        sendHeartbeat();
      }
      // NOTE: We intentionally do NOT send offline beacon on visibility hidden.
      // Switching tabs should not make user disappear from the map.
      // Only pagehide/beforeunload (browser/tab close) should trigger offline.
    };

    // Handle page unload (browser close, tab close, navigation away)
    const handlePageHide = () => {
      sendOfflineBeacon();
    };

    // Send initial heartbeat on mount
    sendHeartbeat();

    // Set up periodic heartbeat
    intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);
    // Listen for page hide (more reliable than beforeunload for mobile)
    window.addEventListener('pagehide', handlePageHide);
    // Fallback for older browsers
    window.addEventListener('beforeunload', handlePageHide);

    return () => {
      isActiveRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
    };
  }, [userId]);
};
