import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getOrCreateChannel, safeRemoveChannel } from '@/lib/realtimeUtils';
import { useMapRefetch } from './useMapRefetch';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';

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
  kind?: 'event' | 'shout';
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
  const queryClient = useQueryClient();
  
  // Get MapRefetch functions to trigger map updates when comments/likes are added
  // Use refs to avoid dependency issues in useEffect
  const { triggerShoutRefetch, triggerEventRefetch, triggerCountRefetch } = useMapRefetch();
  const triggerShoutRefetchRef = useRef(triggerShoutRefetch);
  const triggerEventRefetchRef = useRef(triggerEventRefetch);
  const triggerCountRefetchRef = useRef(triggerCountRefetch);
  
  // Keep refs in sync
  useEffect(() => {
    triggerShoutRefetchRef.current = triggerShoutRefetch;
    triggerEventRefetchRef.current = triggerEventRefetch;
    triggerCountRefetchRef.current = triggerCountRefetch;
  }, [triggerShoutRefetch, triggerEventRefetch, triggerCountRefetch]);

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

      // Fetch resource info (events/shouts) for deep linking.
      // IMPORTANT: `new_comment` may point to either an event (megaphone) OR a shout.
      const eventIds = notifs
        .filter(n => n.type === 'friend_event' || n.type === 'new_participant')
        .map(n => n.resource_id);
      
      const shoutIds = notifs
        .filter(n => n.type === 'friend_shout')
        .map(n => n.resource_id);

      const maybeCommentResourceIds = notifs
        .filter(n => n.type === 'new_comment')
        .map(n => n.resource_id);

      const resources: Record<string, ResourceInfo> = {};

      // Fetch events using RPC to avoid 406 errors (megaphones may be a view)
      const eventCandidateIds = [...new Set([...eventIds, ...maybeCommentResourceIds])];
      if (eventCandidateIds.length > 0) {
        try {
          // Try batch fetch, but handle errors gracefully
          const { data: events, error: eventsError } = await supabase
            .from('megaphones')
            .select('id, title, lat, lng')
            .in('id', eventCandidateIds);
          
          if (!eventsError && events) {
            events.forEach(e => {
              resources[e.id] = { kind: 'event', title: e.title, lat: e.lat, lng: e.lng };
            });
          } else if (eventsError) {
            // If batch fetch fails, try individual fetches with error handling
            console.warn('[Notifications] Batch megaphones fetch failed, skipping resource info:', eventsError);
          }
        } catch (error) {
          console.warn('[Notifications] Error fetching megaphones for notifications:', error);
        }
      }

      const shoutCandidateIds = [...new Set([...shoutIds, ...maybeCommentResourceIds])];
      if (shoutCandidateIds.length > 0) {
        const { data: shouts } = await supabase
          .from('shouts')
          .select('id, content, lat, lng')
          .in('id', shoutCandidateIds);
        
        shouts?.forEach(s => {
          resources[s.id] = { 
            kind: 'shout',
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

  // Use ref to avoid re-subscribing when fetchNotifications changes
  const fetchNotificationsRef = useRef(fetchNotifications);
  useEffect(() => {
    fetchNotificationsRef.current = fetchNotifications;
  }, [fetchNotifications]);

  // Real-time subscription for new notifications
  // GLOBAL subscription pattern: stable channel name, client-side filtering
  useEffect(() => {
    if (!currentUserId) return;

    // Use stable channel name (no Date.now() to prevent channel recreation)
    const channelName = `notifications-global-${currentUserId}`;
    
    // Get or create channel - ALWAYS attach handlers, only subscribe if needed
    const { channel, shouldSubscribe } = getOrCreateChannel(channelName);
    
    console.log('[Notifications] Setting up realtime subscription:', channelName);
    
    channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          // NO SERVER-SIDE FILTER - use client-side filtering like Chat does
        },
        (payload) => {
          const newNotif = payload.new as DbNotification;
          
          // CLIENT-SIDE FILTERING (like Chat does with sender_id check)
          // Only process notifications for the current user
          if (newNotif.recipient_id !== currentUserId) {
            return;
          }
          
          console.log('[Notifications] New notification received via realtime:', newNotif.id, newNotif.type);
          
          // CRITICAL: Set hasUnread to true FIRST (before any state updates)
          // This ensures the red dot appears instantly, even if notification list update is delayed
          setHasUnread(true);
          
          // WORKAROUND: Trigger map refetches when engagement notifications are received
          // This ensures other users see updates even if direct realtime for engagement tables fails
          // (Supabase Realtime can have issues with complex RLS policies on engagement tables)
          if (newNotif.type === 'new_comment') {
            console.log('[Notifications] 🔄 Triggering map refetch for new_comment notification');
            // Invalidate React Query caches
            queryClient.invalidateQueries({ queryKey: queryKeys.allShoutCounts() });
            queryClient.invalidateQueries({ queryKey: queryKeys.allShouts() });
            queryClient.invalidateQueries({ queryKey: queryKeys.allSpotComments() });
            queryClient.invalidateQueries({ queryKey: queryKeys.allEvents() });
            // Use refs to call stable functions
            triggerShoutRefetchRef.current();
            triggerEventRefetchRef.current();
            triggerCountRefetchRef.current();
          }
          
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
              // NOTE: Single-row fetches from megaphones view may fail with 406
              // We handle errors gracefully and skip resource info if fetch fails
              const resourceId = newNotif.resource_id;
              const type = newNotif.type;
              
              if (type === 'friend_event' || type === 'new_participant' || type === 'new_comment') {
                try {
                  const { data: events, error: eventsError } = await supabase
                    .from('megaphones')
                    .select('id, title, lat, lng')
                    .eq('id', resourceId)
                    .maybeSingle();
                  
                  // Only update if fetch succeeded (handle 406 gracefully)
                  if (!eventsError && events) {
                    setResourceMap(prev => ({
                      ...prev,
                      [events.id]: { title: events.title, lat: events.lat, lng: events.lng }
                    }));
                  } else if (eventsError) {
                    // Silently skip - megaphones view may not support single-row fetches
                    console.warn('[Notifications] Could not fetch megaphone resource info (expected for views):', eventsError.code);
                  }
                } catch (err) {
                  // Silently skip on any error
                  console.warn('[Notifications] Error fetching megaphone resource:', err);
                }
              } else if (type === 'friend_shout') {
                try {
                  const { data: shout, error: shoutError } = await supabase
                    .from('shouts')
                    .select('id, content, lat, lng')
                    .eq('id', resourceId)
                    .maybeSingle();
                  
                  if (!shoutError && shout) {
                    setResourceMap(prev => ({
                      ...prev,
                      [shout.id]: { 
                        content: shout.content.length > 50 ? shout.content.substring(0, 50) + '...' : shout.content, 
                        lat: shout.lat, 
                        lng: shout.lng 
                      }
                    }));
                  }
                } catch (err) {
                  console.warn('[Notifications] Error fetching shout resource:', err);
                }
              }
            } catch (error) {
              console.error('[Notifications] Error fetching additional data:', error);
            }
          })();
        }
      );
    
    // Subscribe to the channel
    channel.subscribe((status) => {
      console.log('[Notifications] Subscription status:', status);
      if (status === 'SUBSCRIBED') {
        console.log('[Notifications] ✅ Successfully subscribed');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[Notifications] Channel error - subscription failed');
      }
    });

    return () => {
      console.log('[Notifications] Cleaning up subscription:', channelName);
      safeRemoveChannel(channel);
    };
  }, [currentUserId, queryClient]);

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

  // Delete a single notification (Optimistic UI) - used by the "X" button
  const deleteNotification = useCallback(async (notificationId: string) => {
    if (!currentUserId) return;

    let previousNotifications: DbNotification[] = [];

    // Optimistic: remove from UI immediately
    setNotifications(prev => {
      previousNotifications = prev;
      const next = prev.filter(n => n.id !== notificationId);
      setHasUnread(next.some(n => !n.is_read));
      return next;
    });

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('recipient_id', currentUserId);

    if (error) {
      console.error('[Notifications] Delete failed:', error);
      // Roll back optimistic remove
      setNotifications(previousNotifications);
      setHasUnread(previousNotifications.some(n => !n.is_read));
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
    deleteNotification,
    getResourceInfo,
    refetch: fetchNotifications,
  };
};
