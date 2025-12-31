import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Notification {
  id: string;
  type: 'new_spot' | 'invitation_received' | 'invitation_accepted' | 'user_joined' | 'followed_spot' | 'followed_shout';
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  metadata?: {
    spotId?: string;
    shoutId?: string;
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
  const [followingIds, setFollowingIds] = useState<string[]>([]);

  // Load persisted dismissed/read state on mount
  useEffect(() => {
    if (currentUserId) {
      setDismissedIds(getDismissedIds(currentUserId));
      setReadIds(getReadIds(currentUserId));
    }
  }, [currentUserId]);

  // Fetch list of users the current user is following
  useEffect(() => {
    if (!currentUserId) {
      setFollowingIds([]);
      return;
    }

    const fetchFollowing = async () => {
      const { data } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', currentUserId);

      setFollowingIds(data?.map(f => f.following_id) || []);
    };

    fetchFollowing();

    // Subscribe to follow changes
    const channel = supabase
      .channel(`following-${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'follows',
          filter: `follower_id=eq.${currentUserId}`,
        },
        fetchFollowing
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
          const isFollowed = followingIds.includes(spot.host_id);
          const notifId = isFollowed ? `followed-spot-${spot.id}` : `spot-${spot.id}`;
          
          // Skip if dismissed
          if (currentDismissedIds.has(notifId)) return;
          
          const host = profiles?.find(p => p.id === spot.host_id);
          
          if (isFollowed) {
            // Followed user's spot - priority notification
            notifs.push({
              id: notifId,
              type: 'followed_spot',
              title: `${host?.nick || 'Someone'} created an event`,
              description: `"${spot.title}"`,
              timestamp: spot.created_at,
              read: currentReadIds.has(notifId),
              metadata: {
                spotId: spot.id,
                userId: spot.host_id,
                lat: spot.lat,
                lng: spot.lng,
              },
            });
          } else {
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
          }
        });
      }

      // Fetch shouts from followed users (last 24 hours)
      if (followingIds.length > 0) {
        const { data: followedShouts } = await supabase
          .from('shouts')
          .select('id, content, created_at, user_id, lat, lng')
          .in('user_id', followingIds)
          .gte('created_at', effectiveCutoff)
          .order('created_at', { ascending: false })
          .limit(10);

        if (followedShouts && followedShouts.length > 0) {
          const shoutUserIds = [...new Set(followedShouts.map(s => s.user_id))];
          const { data: shoutProfiles } = await supabase
            .rpc('get_public_profiles_by_ids', { user_ids: shoutUserIds });

          followedShouts.forEach(shout => {
            const notifId = `followed-shout-${shout.id}`;
            
            if (currentDismissedIds.has(notifId)) return;
            
            const author = shoutProfiles?.find(p => p.id === shout.user_id);
            const contentSnippet = shout.content.length > 50 
              ? shout.content.substring(0, 50) + '...' 
              : shout.content;
            
            notifs.push({
              id: notifId,
              type: 'followed_shout',
              title: `${author?.nick || 'Someone'} shouted`,
              description: `"${contentSnippet}"`,
              timestamp: shout.created_at,
              read: currentReadIds.has(notifId),
              metadata: {
                shoutId: shout.id,
                userId: shout.user_id,
                lat: shout.lat,
                lng: shout.lng,
              },
            });
          });
        }
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

      // Sort by timestamp, with followed content slightly prioritized
      notifs.sort((a, b) => {
        // Followed content gets a slight boost
        const aIsFollowed = a.type === 'followed_spot' || a.type === 'followed_shout';
        const bIsFollowed = b.type === 'followed_spot' || b.type === 'followed_shout';
        
        if (aIsFollowed && !bIsFollowed) return -1;
        if (!aIsFollowed && bIsFollowed) return 1;
        
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.read).length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }

    setLoading(false);
  }, [currentUserId, followingIds]);

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

          const isFollowed = followingIds.includes(payload.new.host_id);
          const notifId = isFollowed ? `followed-spot-${payload.new.id}` : `spot-${payload.new.id}`;
          
          // Skip if already dismissed
          if (dismissedIds.has(notifId)) return;

          const { data: profiles } = await supabase
            .rpc('get_public_profiles_by_ids', { user_ids: [payload.new.host_id] });
          
          const host = profiles?.[0];

          const newNotif: Notification = isFollowed ? {
            id: notifId,
            type: 'followed_spot',
            title: `${host?.nick || 'Someone'} created an event`,
            description: `"${payload.new.title}"`,
            timestamp: payload.new.created_at,
            read: false,
            metadata: {
              spotId: payload.new.id,
              userId: payload.new.host_id,
              lat: payload.new.lat,
              lng: payload.new.lng,
            },
          } : {
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
  }, [currentUserId, dismissedIds, followingIds]);

  // Real-time subscription for shouts from followed users
  useEffect(() => {
    if (!currentUserId || followingIds.length === 0) return;

    const channel = supabase
      .channel('notifications-followed-shouts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'shouts',
        },
        async (payload) => {
          // Only notify for shouts from followed users
          if (!followingIds.includes(payload.new.user_id)) return;

          const notifId = `followed-shout-${payload.new.id}`;
          
          if (dismissedIds.has(notifId)) return;

          const { data: profiles } = await supabase
            .rpc('get_public_profiles_by_ids', { user_ids: [payload.new.user_id] });
          
          const author = profiles?.[0];
          const contentSnippet = payload.new.content.length > 50 
            ? payload.new.content.substring(0, 50) + '...' 
            : payload.new.content;

          const newNotif: Notification = {
            id: notifId,
            type: 'followed_shout',
            title: `${author?.nick || 'Someone'} shouted`,
            description: `"${contentSnippet}"`,
            timestamp: payload.new.created_at,
            read: false,
            metadata: {
              shoutId: payload.new.id,
              userId: payload.new.user_id,
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
  }, [currentUserId, dismissedIds, followingIds]);

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
