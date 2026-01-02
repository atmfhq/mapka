import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DbNotification {
  id: string;
  recipient_id: string;
  trigger_user_id: string;
  type: 'friend_event' | 'friend_shout' | 'new_participant' | 'new_comment';
  resource_id: string;
  is_read: boolean;
  created_at: string;
  // Joined data
  trigger_user?: {
    nick: string | null;
    avatar_url: string | null;
    avatar_config: unknown;
  };
}

interface ResourceInfo {
  title?: string;
  content?: string;
  lat?: number;
  lng?: number;
}

export const useDbNotifications = (currentUserId: string | null) => {
  const [notifications, setNotifications] = useState<DbNotification[]>([]);
  const [hasUnread, setHasUnread] = useState(false);
  const [loading, setLoading] = useState(true);
  const [resourceMap, setResourceMap] = useState<Record<string, ResourceInfo>>({});

  // Fetch notifications from DB
  const fetchNotifications = useCallback(async () => {
    if (!currentUserId) {
      setNotifications([]);
      setHasUnread(false);
      setLoading(false);
      return;
    }

    try {
      // Fetch notifications for this user (last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', currentUserId)
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('[Notifications] Fetch error:', error);
        setLoading(false);
        return;
      }

      const notifs = data || [];
      
      // Fetch trigger user profiles
      const triggerUserIds = [...new Set(notifs.map(n => n.trigger_user_id))];
      if (triggerUserIds.length > 0) {
        const { data: profiles } = await supabase
          .rpc('get_profiles_display', { user_ids: triggerUserIds });
        
        // Attach profile data to notifications
        notifs.forEach(n => {
          const profile = profiles?.find((p: { id: string }) => p.id === n.trigger_user_id);
          if (profile) {
            (n as DbNotification).trigger_user = {
              nick: profile.nick,
              avatar_url: profile.avatar_url,
              avatar_config: profile.avatar_config,
            };
          }
        });
      }

      // Fetch resource info (events/shouts) for deep linking
      const eventIds = notifs
        .filter(n => n.type === 'friend_event' || n.type === 'new_participant' || n.type === 'new_comment')
        .map(n => n.resource_id);
      
      const shoutIds = notifs
        .filter(n => n.type === 'friend_shout')
        .map(n => n.resource_id);

      const resources: Record<string, ResourceInfo> = {};

      if (eventIds.length > 0) {
        const { data: events } = await supabase
          .from('megaphones')
          .select('id, title, lat, lng')
          .in('id', eventIds);
        
        events?.forEach(e => {
          resources[e.id] = { title: e.title, lat: e.lat, lng: e.lng };
        });
      }

      if (shoutIds.length > 0) {
        const { data: shouts } = await supabase
          .from('shouts')
          .select('id, content, lat, lng')
          .in('id', shoutIds);
        
        shouts?.forEach(s => {
          resources[s.id] = { 
            content: s.content.length > 50 ? s.content.substring(0, 50) + '...' : s.content, 
            lat: s.lat, 
            lng: s.lng 
          };
        });
      }

      setResourceMap(resources);
      setNotifications(notifs as DbNotification[]);
      setHasUnread(notifs.some(n => !n.is_read));
    } catch (error) {
      console.error('[Notifications] Error:', error);
    }

    setLoading(false);
  }, [currentUserId]);

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Real-time subscription for new notifications
  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel(`notifications-${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${currentUserId}`,
        },
        async (payload) => {
          console.log('[Notifications] New notification:', payload.new);
          
          // Fetch the trigger user profile
          const { data: profiles } = await supabase
            .rpc('get_profiles_display', { user_ids: [payload.new.trigger_user_id] });
          
          const newNotif: DbNotification = {
            ...(payload.new as DbNotification),
            trigger_user: profiles?.[0] ? {
              nick: profiles[0].nick,
              avatar_url: profiles[0].avatar_url,
              avatar_config: profiles[0].avatar_config,
            } : undefined,
          };

          // Fetch resource info for the new notification
          const resourceId = payload.new.resource_id;
          const type = payload.new.type;
          
          if (type === 'friend_event' || type === 'new_participant' || type === 'new_comment') {
            const { data: events } = await supabase
              .from('megaphones')
              .select('id, title, lat, lng')
              .eq('id', resourceId)
              .single();
            
            if (events) {
              setResourceMap(prev => ({
                ...prev,
                [events.id]: { title: events.title, lat: events.lat, lng: events.lng }
              }));
            }
          } else if (type === 'friend_shout') {
            const { data: shout } = await supabase
              .from('shouts')
              .select('id, content, lat, lng')
              .eq('id', resourceId)
              .single();
            
            if (shout) {
              setResourceMap(prev => ({
                ...prev,
                [shout.id]: { 
                  content: shout.content.length > 50 ? shout.content.substring(0, 50) + '...' : shout.content, 
                  lat: shout.lat, 
                  lng: shout.lng 
                }
              }));
            }
          }

          setNotifications(prev => [newNotif, ...prev]);
          setHasUnread(true);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${currentUserId}`,
        },
        (payload) => {
          setNotifications(prev => 
            prev.map(n => n.id === payload.new.id ? { ...n, ...payload.new } : n)
          );
          // Recalculate hasUnread
          setNotifications(prev => {
            setHasUnread(prev.some(n => !n.is_read));
            return prev;
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${currentUserId}`,
        },
        (payload) => {
          setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  // Mark single notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!currentUserId) return;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('recipient_id', currentUserId);

    if (!error) {
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setNotifications(prev => {
        setHasUnread(prev.some(n => !n.is_read));
        return prev;
      });
    }
  }, [currentUserId]);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    if (!currentUserId) return;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_id', currentUserId)
      .eq('is_read', false);

    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setHasUnread(false);
    }
  }, [currentUserId]);

  // Clear all notifications
  const clearAll = useCallback(async () => {
    if (!currentUserId) return;

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('recipient_id', currentUserId);

    if (!error) {
      setNotifications([]);
      setHasUnread(false);
    }
  }, [currentUserId]);

  // Get resource info for a notification
  const getResourceInfo = useCallback((resourceId: string): ResourceInfo | undefined => {
    return resourceMap[resourceId];
  }, [resourceMap]);

  return {
    notifications,
    hasUnread,
    loading,
    markAsRead,
    markAllAsRead,
    clearAll,
    getResourceInfo,
    refetch: fetchNotifications,
  };
};
