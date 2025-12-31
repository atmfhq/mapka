import { useCallback, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ProximityAlertItem {
  id: string;
  user_id: string;
  type: 'shout' | 'event';
}

interface UserProfile {
  id: string;
  nick: string | null;
}

/**
 * Hook to detect and alert when content from followed users appears in range.
 * Includes deduplication to prevent spam when user moves back and forth.
 */
export const useProximityAlerts = (
  currentUserId: string | null,
  followingIds: string[]
) => {
  const { toast } = useToast();
  
  // Track already-alerted items (persisted per session)
  const alertedIdsRef = useRef<Set<string>>(new Set());
  
  // Cooldown tracking per user to prevent spam
  const lastAlertTimeRef = useRef<Map<string, number>>(new Map());
  const COOLDOWN_MS = 60000; // 1 minute cooldown per user

  // Fetch user profile for display name
  const fetchUserNick = useCallback(async (userId: string): Promise<string> => {
    const { data } = await supabase.rpc('get_public_profile', { p_user_id: userId });
    return data?.[0]?.nick || 'Someone you follow';
  }, []);

  // Check if we should alert for this user (cooldown check)
  const shouldAlert = useCallback((userId: string, itemId: string): boolean => {
    // Already alerted for this specific item
    if (alertedIdsRef.current.has(itemId)) {
      return false;
    }

    // Check user cooldown
    const lastAlert = lastAlertTimeRef.current.get(userId);
    if (lastAlert && Date.now() - lastAlert < COOLDOWN_MS) {
      return false;
    }

    return true;
  }, []);

  // Mark item as alerted and update cooldown
  const markAlerted = useCallback((userId: string, itemId: string) => {
    alertedIdsRef.current.add(itemId);
    lastAlertTimeRef.current.set(userId, Date.now());
  }, []);

  // Process newly visible items and trigger alerts
  const processNewItems = useCallback(async (
    items: ProximityAlertItem[],
    previousItemIds: Set<string>
  ) => {
    if (!currentUserId || followingIds.length === 0) return;

    // Find newly appeared items from followed users
    const newFromFollowed = items.filter(item => 
      !previousItemIds.has(item.id) &&
      followingIds.includes(item.user_id) &&
      item.user_id !== currentUserId &&
      shouldAlert(item.user_id, item.id)
    );

    if (newFromFollowed.length === 0) return;

    // Group by user to avoid multiple toasts
    const byUser = new Map<string, ProximityAlertItem[]>();
    newFromFollowed.forEach(item => {
      const existing = byUser.get(item.user_id) || [];
      byUser.set(item.user_id, [...existing, item]);
    });

    // Alert for each user (max 1 alert per user due to cooldown)
    for (const [userId, userItems] of byUser) {
      const firstItem = userItems[0];
      if (!shouldAlert(userId, firstItem.id)) continue;

      const nick = await fetchUserNick(userId);
      const itemType = firstItem.type === 'shout' ? 'Shout' : 'Spot';
      
      toast({
        title: `📍 ${nick} nearby!`,
        description: `You found a ${itemType} by ${nick}`,
      });

      // Mark all items from this user as alerted
      userItems.forEach(item => markAlerted(userId, item.id));
    }
  }, [currentUserId, followingIds, shouldAlert, markAlerted, fetchUserNick, toast]);

  return { processNewItems };
};

/**
 * Utility hook to get just the IDs of users the current user is following.
 * Lighter weight than useFollowingList when you just need IDs.
 */
export const useFollowingIds = (currentUserId: string | null) => {
  const idsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!currentUserId) {
      idsRef.current = [];
      return;
    }

    const fetchIds = async () => {
      const { data } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', currentUserId);
      
      idsRef.current = data?.map(f => f.following_id) || [];
    };

    fetchIds();

    // Subscribe to changes
    const channel = supabase
      .channel(`following-ids-${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'follows',
          filter: `follower_id=eq.${currentUserId}`,
        },
        () => fetchIds()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  return idsRef.current;
};
