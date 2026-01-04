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
      // Preserve realtime-set true state, or set based on data if currently false
      setHasUnread(prev => prev || notifs.some(n => !n.is_read));
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
  // Using server-side filtering with REPLICA IDENTITY FULL (database is now configured)
  useEffect(() => {
    if (!currentUserId) return;

    const channelName = 'notif-' + currentUserId;
    console.log('[Notifications] Setting up realtime subscription:', channelName);
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: 'recipient_id=eq.' + currentUserId,
        },
        (payload) => {
          const newNotif = payload.new as DbNotification;
          
          console.log('🔔 Realtime notification incoming:', payload);
          
          // CRITICAL: Set hasUnread to true FIRST (before any state updates)
          // This ensures the red dot appears instantly, even if notification list update is delayed
          setHasUnread(true);
          
          // Add to state immediately (prepend to array)
          setNotifications(prev => {
            // Check for duplicates
            if (prev.some(n => n.id === newNotif.id)) {
              return prev;
            }
            return [newNotif, ...prev];
          });
          
          // Fetch additional data in background (non-blocking)
          (async () => {
            try {
              // Fetch trigger user profile
              const { data: profiles } = await supabase
                .rpc('get_profiles_display', { user_ids: [newNotif.trigger_user_id] });
              
              if (profiles?.[0]) {
                setNotifications(prev => 
                  prev.map(n => 
                    n.id === newNotif.id 
                      ? { 
                          ...n, 
                          trigger_user: {
                            nick: profiles[0].nick,
                            avatar_url: profiles[0].avatar_url,
                            avatar_config: profiles[0].avatar_config,
                          }
                        }
                      : n
                  )
                );
              }

              // Fetch resource info
              const resourceId = newNotif.resource_id;
              const type = newNotif.type;
              
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
            } catch (error) {
              console.error('[Notifications] Error fetching additional data:', error);
            }
          })();
        }
      )
      .subscribe((status) => {
        console.log('[Notifications] Subscription status:', status);
        if (status === 'CHANNEL_ERROR') {
          console.error('[Notifications] Channel error - subscription failed');
        }
      });

    return () => {
      console.log('[Notifications] Cleaning up subscription:', channelName);
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  // Mark single notification as read (Optimistic UI)
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!currentUserId) return;

    // Optimistic update: update state immediately
    let previousNotifications: DbNotification[] = [];
    
    setNotifications(prev => {
      previousNotifications = prev;
      const updated = prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n);
      const newHasUnread = updated.some(n => !n.is_read);
      setHasUnread(newHasUnread);
      return updated;
    });

    // Update DB (if it fails, rollback)
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('recipient_id', currentUserId);

    if (error) {
      // Rollback on error - recalculate hasUnread from previous state
      console.error('[Notifications] Mark as read failed:', error);
      setNotifications(previousNotifications);
      setHasUnread(previousNotifications.some(n => !n.is_read));
    }
  }, [currentUserId]);

  // Mark all as read (Optimistic UI)
  const markAllAsRead = useCallback(async () => {
    if (!currentUserId) return;

    // Optimistic update: update state immediately
    let previousNotifications: DbNotification[] = [];
    
    setNotifications(prev => {
      previousNotifications = prev;
      return prev.map(n => ({ ...n, is_read: true }));
    });
    setHasUnread(false);

    // Update DB (if it fails, rollback)
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_id', currentUserId)
      .eq('is_read', false);

    if (error) {
      // Rollback on error
      console.error('[Notifications] Mark all as read failed:', error);
      setNotifications(previousNotifications);
      setHasUnread(previousNotifications.some(n => !n.is_read));
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
