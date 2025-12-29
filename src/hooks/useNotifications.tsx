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

export const useNotifications = (currentUserId: string | null) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch recent notifications (spots created nearby, etc.)
  const fetchNotifications = useCallback(async () => {
    if (!currentUserId) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    try {
      // Get user's location for nearby spots
      const { data: profile } = await supabase
        .from('profiles')
        .select('location_lat, location_lng')
        .eq('id', currentUserId)
        .single();

      const notifs: Notification[] = [];

      // Fetch recent public spots (last 24 hours)
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data: recentSpots } = await supabase
        .from('megaphones')
        .select('id, title, category, created_at, host_id, lat, lng')
        .eq('is_private', false)
        .neq('host_id', currentUserId)
        .gte('created_at', twentyFourHoursAgo)
        .order('created_at', { ascending: false })
        .limit(10);

      if (recentSpots) {
        const hostIds = [...new Set(recentSpots.map(s => s.host_id))];
        const { data: profiles } = await supabase
          .rpc('get_public_profiles_by_ids', { user_ids: hostIds });

        recentSpots.forEach(spot => {
          const host = profiles?.find(p => p.id === spot.host_id);
          notifs.push({
            id: `spot-${spot.id}`,
            type: 'new_spot',
            title: 'New Spot Nearby',
            description: `${host?.nick || 'Someone'} created "${spot.title}"`,
            timestamp: spot.created_at,
            read: false, // We'll track read state locally for now
            metadata: {
              spotId: spot.id,
              lat: spot.lat,
              lng: spot.lng,
            },
          });
        });
      }

      // Fetch users who joined MY spots (last 24 hours)
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
          .gte('joined_at', twentyFourHoursAgo)
          .order('joined_at', { ascending: false })
          .limit(10);

        if (recentJoins && recentJoins.length > 0) {
          const joinerIds = [...new Set(recentJoins.map(j => j.user_id))];
          const { data: joinerProfiles } = await supabase
            .rpc('get_public_profiles_by_ids', { user_ids: joinerIds });

          recentJoins.forEach(join => {
            const joiner = joinerProfiles?.find(p => p.id === join.user_id);
            const spot = mySpots.find(s => s.id === join.event_id);
            notifs.push({
              id: `join-${join.id}`,
              type: 'user_joined',
              title: 'New Participant',
              description: `${joiner?.nick || 'Someone'} joined "${spot?.title || 'your spot'}"`,
              timestamp: join.joined_at,
              read: false,
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

          const { data: profiles } = await supabase
            .rpc('get_public_profiles_by_ids', { user_ids: [payload.new.host_id] });
          
          const host = profiles?.[0];

          const newNotif: Notification = {
            id: `spot-${payload.new.id}`,
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
  }, [currentUserId]);

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

          // Check if this is for one of my spots
          const { data: spot } = await supabase
            .from('megaphones')
            .select('id, title, host_id')
            .eq('id', payload.new.event_id)
            .eq('host_id', currentUserId)
            .single();

          if (!spot) return;

          const { data: profiles } = await supabase
            .rpc('get_public_profiles_by_ids', { user_ids: [payload.new.user_id] });
          
          const joiner = profiles?.[0];

          const newNotif: Notification = {
            id: `join-${payload.new.id}`,
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
  }, [currentUserId]);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    refetch: fetchNotifications,
    markAllAsRead,
    markAsRead,
    clearNotifications,
  };
};
