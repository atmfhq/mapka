import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Notification {
  id: string;
  type: 'new_spot' | 'invitation_received' | 'invitation_accepted' | 'user_joined';
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  metadata?: {
    spotId?: string;
    userId?: string;
    lat?: number;
    lng?: number;
  };
}

interface PublicProfile {
  id: string;
  nick: string;
  avatar_url: string;
  avatar_config: unknown;
}

// Storage keys for persistence
const DISMISSED_KEY = 'dismissed_notifications';
const READ_KEY = 'read_notifications';

// Get dismissed notification IDs from localStorage
const getDismissedIds = (userId: string): Set<string> => {
  try {
    const stored = localStorage.getItem(`${DISMISSED_KEY}_${userId}`);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
};

// Save dismissed notification IDs to localStorage
const saveDismissedIds = (userId: string, ids: Set<string>) => {
  try {
    localStorage.setItem(`${DISMISSED_KEY}_${userId}`, JSON.stringify([...ids]));
  } catch {
    console.error('Failed to save dismissed notifications');
  }
};

// Get read notification IDs from localStorage
const getReadIds = (userId: string): Set<string> => {
  try {
    const stored = localStorage.getItem(`${READ_KEY}_${userId}`);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
};

// Save read notification IDs to localStorage
const saveReadIds = (userId: string, ids: Set<string>) => {
  try {
    localStorage.setItem(`${READ_KEY}_${userId}`, JSON.stringify([...ids]));
  } catch {
    console.error('Failed to save read notifications');
  }
};

export const useNotifications = (currentUserId: string | null) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [userCreatedAt, setUserCreatedAt] = useState<string | null>(null);

  // Load persisted dismissed/read state on mount
  useEffect(() => {
    if (currentUserId) {
      setDismissedIds(getDismissedIds(currentUserId));
      setReadIds(getReadIds(currentUserId));
    }
  }, [currentUserId]);

  // Fetch recent notifications (spots created nearby, etc.)
  const fetchNotifications = useCallback(async () => {
    if (!currentUserId) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    try {
      // Get user's profile including created_at for filtering
      const { data: profile } = await supabase
        .from('profiles')
        .select('location_lat, location_lng, created_at')
        .eq('id', currentUserId)
        .single();

      // Store user's creation time for filtering
      const accountCreatedAt = profile?.created_at || new Date().toISOString();
      setUserCreatedAt(accountCreatedAt);

      const notifs: Notification[] = [];
      const currentDismissedIds = getDismissedIds(currentUserId);
      const currentReadIds = getReadIds(currentUserId);

      // Fetch recent public spots (last 24 hours, but not before user's account creation)
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      // Use the later of: 24 hours ago OR user's account creation time
      const effectiveCutoff = accountCreatedAt > twentyFourHoursAgo 
        ? accountCreatedAt 
        : twentyFourHoursAgo;
      
      const { data: recentSpots } = await supabase
        .from('megaphones')
        .select('id, title, category, created_at, host_id, lat, lng')
        .eq('is_private', false)
        .neq('host_id', currentUserId)
        .gte('created_at', effectiveCutoff)
        .order('created_at', { ascending: false })
        .limit(10);

      if (recentSpots) {
        const hostIds = [...new Set(recentSpots.map(s => s.host_id))];
        const { data: profiles } = await supabase
          .rpc('get_public_profiles_by_ids', { user_ids: hostIds });

        recentSpots.forEach(spot => {
          const notifId = `spot-${spot.id}`;
          
          // Skip if dismissed
          if (currentDismissedIds.has(notifId)) return;
          
          const host = profiles?.find(p => p.id === spot.host_id);
          notifs.push({
            id: notifId,
            type: 'new_spot',
            title: 'New Spot Nearby',
            description: `${host?.nick || 'Someone'} created "${spot.title}"`,
            timestamp: spot.created_at,
            read: currentReadIds.has(notifId),
            metadata: {
              spotId: spot.id,
              lat: spot.lat,
              lng: spot.lng,
            },
          });
        });
      }

      // Fetch users who joined MY spots (last 24 hours, but not before account creation)
      const { data: mySpots } = await supabase
        .from('megaphones')
        .select('id, title')
        .eq('host_id', currentUserId);

      if (mySpots && mySpots.length > 0) {
        const spotIds = mySpots.map(s => s.id);
        
        const { data: recentJoins } = await supabase
          .from('event_participants')
          .select('id, event_id, user_id, joined_at')
          .in('event_id', spotIds)
          .neq('user_id', currentUserId)
          .eq('status', 'joined')
          .gte('joined_at', effectiveCutoff)
          .order('joined_at', { ascending: false })
          .limit(10);

        if (recentJoins && recentJoins.length > 0) {
          const joinerIds = [...new Set(recentJoins.map(j => j.user_id))];
          const { data: joinerProfiles } = await supabase
            .rpc('get_public_profiles_by_ids', { user_ids: joinerIds });

          recentJoins.forEach(join => {
            const notifId = `join-${join.id}`;
            
            // Skip if dismissed
            if (currentDismissedIds.has(notifId)) return;
            
            const joiner = joinerProfiles?.find(p => p.id === join.user_id);
            const spot = mySpots.find(s => s.id === join.event_id);
            notifs.push({
              id: notifId,
              type: 'user_joined',
              title: 'New Participant',
              description: `${joiner?.nick || 'Someone'} joined "${spot?.title || 'your spot'}"`,
              timestamp: join.joined_at,
              read: currentReadIds.has(notifId),
              metadata: {
                spotId: join.event_id,
                userId: join.user_id,
              },
            });
          });
        }
      }

      // Sort by timestamp
      notifs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.read).length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }

    setLoading(false);
  }, [currentUserId]);

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Real-time subscription for new spots
  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel('notifications-spots')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'megaphones',
        },
        async (payload) => {
          if (payload.new.is_private || payload.new.host_id === currentUserId) return;

          const notifId = `spot-${payload.new.id}`;
          
          // Skip if already dismissed
          if (dismissedIds.has(notifId)) return;

          const { data: profiles } = await supabase
            .rpc('get_public_profiles_by_ids', { user_ids: [payload.new.host_id] });
          
          const host = profiles?.[0];

          const newNotif: Notification = {
            id: notifId,
            type: 'new_spot',
            title: 'New Spot Nearby',
            description: `${host?.nick || 'Someone'} created "${payload.new.title}"`,
            timestamp: payload.new.created_at,
            read: false,
            metadata: {
              spotId: payload.new.id,
              lat: payload.new.lat,
              lng: payload.new.lng,
            },
          };

          setNotifications(prev => [newNotif, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, dismissedIds]);

  // Real-time subscription for new participants in MY spots
  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel('notifications-participants')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'event_participants',
        },
        async (payload) => {
          if (payload.new.user_id === currentUserId) return;

          const notifId = `join-${payload.new.id}`;
          
          // Skip if already dismissed
          if (dismissedIds.has(notifId)) return;

          // Check if this is for one of my spots
          const { data: spot } = await supabase
            .from('megaphones')
            .select('id, title, host_id')
            .eq('id', payload.new.event_id)
            .eq('host_id', currentUserId)
            .maybeSingle();

          if (!spot) return;

          const { data: profiles } = await supabase
            .rpc('get_public_profiles_by_ids', { user_ids: [payload.new.user_id] });
          
          const joiner = profiles?.[0];

          const newNotif: Notification = {
            id: notifId,
            type: 'user_joined',
            title: 'New Participant',
            description: `${joiner?.nick || 'Someone'} joined "${spot.title}"`,
            timestamp: payload.new.joined_at,
            read: false,
            metadata: {
              spotId: spot.id,
              userId: payload.new.user_id,
            },
          };

          setNotifications(prev => [newNotif, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, dismissedIds]);

  const markAllAsRead = useCallback(() => {
    if (!currentUserId) return;
    
    setNotifications(prev => {
      const allIds = new Set(prev.map(n => n.id));
      const newReadIds = new Set([...readIds, ...allIds]);
      saveReadIds(currentUserId, newReadIds);
      setReadIds(newReadIds);
      return prev.map(n => ({ ...n, read: true }));
    });
    setUnreadCount(0);
  }, [currentUserId, readIds]);

  const markAsRead = useCallback((notificationId: string) => {
    if (!currentUserId) return;
    
    const newReadIds = new Set([...readIds, notificationId]);
    saveReadIds(currentUserId, newReadIds);
    setReadIds(newReadIds);
    
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, [currentUserId, readIds]);

  const clearNotifications = useCallback(() => {
    if (!currentUserId) return;
    
    // Add all current notification IDs to dismissed list
    const allIds = new Set([...dismissedIds, ...notifications.map(n => n.id)]);
    saveDismissedIds(currentUserId, allIds);
    setDismissedIds(allIds);
    
    setNotifications([]);
    setUnreadCount(0);
  }, [currentUserId, dismissedIds, notifications]);

  const dismissNotification = useCallback((notificationId: string) => {
    if (!currentUserId) return;
    
    const newDismissedIds = new Set([...dismissedIds, notificationId]);
    saveDismissedIds(currentUserId, newDismissedIds);
    setDismissedIds(newDismissedIds);
    
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    setUnreadCount(prev => {
      const wasUnread = notifications.find(n => n.id === notificationId && !n.read);
      return wasUnread ? Math.max(0, prev - 1) : prev;
    });
  }, [currentUserId, dismissedIds, notifications]);

  return {
    notifications,
    unreadCount,
    loading,
    refetch: fetchNotifications,
    markAllAsRead,
    markAsRead,
    clearNotifications,
    dismissNotification,
  };
};
