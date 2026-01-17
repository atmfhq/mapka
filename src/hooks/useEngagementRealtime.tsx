import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';
import { useMapRefetch } from './useMapRefetch';
import { getOrCreateChannel, safeRemoveChannel } from '@/lib/realtimeUtils';

/**
 * Global realtime listener for engagement TABLES (not views)
 * Invalidates React Query cache when likes/comments change
 * This ensures the map and modals stay in sync with the database
 * 
 * VERIFIED TABLES (all are CREATE TABLE, not CREATE VIEW):
 * - shout_comments (table)
 * - shout_likes (table)
 * - event_likes (table)
 * - spot_comments (table)
 * - spot_comment_likes (table)
 * - shout_comment_likes (table)
 */
export const useEngagementRealtime = () => {
  const queryClient = useQueryClient();
  const { triggerShoutRefetch, triggerEventRefetch, triggerCountRefetch } = useMapRefetch();

  useEffect(() => {
    const channelName = 'engagement-realtime-global-v2';
    
    // Get or create channel - ALWAYS attach handlers, only subscribe if needed
    const { channel, shouldSubscribe } = getOrCreateChannel(channelName);
    
    console.log('[EngagementRealtime] Setting up global engagement listener');
    channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'shout_comments', // TABLE (verified in migrations)
        },
        (payload) => {
          console.log('[EngagementRealtime] 🔔🔔🔔 Shout comment INSERT received:', payload);
          const newComment = payload.new as any;
          console.log('[EngagementRealtime] Comment details:', {
            id: newComment?.id,
            shout_id: newComment?.shout_id,
            user_id: newComment?.user_id,
            content: newComment?.content?.slice(0, 30),
          });
          // Invalidate all shout-related queries
          queryClient.invalidateQueries({ queryKey: queryKeys.allShoutComments() });
          queryClient.invalidateQueries({ queryKey: queryKeys.allShoutCounts() });
          queryClient.invalidateQueries({ queryKey: queryKeys.allShouts() });
          // Trigger map refetches
          console.log('[EngagementRealtime] Triggering shout and count refetches');
          triggerShoutRefetch();
          triggerCountRefetch();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'shout_comments',
        },
        (payload) => {
          console.log('[EngagementRealtime] 🔔 Shout comment DELETE received:', payload.old);
          queryClient.invalidateQueries({ queryKey: queryKeys.allShoutComments() });
          queryClient.invalidateQueries({ queryKey: queryKeys.allShoutCounts() });
          queryClient.invalidateQueries({ queryKey: queryKeys.allShouts() });
          // Trigger map refetches
          triggerShoutRefetch();
          triggerCountRefetch();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'shout_likes',
        },
        (payload) => {
          console.log('[EngagementRealtime] 🔔 Shout like INSERT received:', payload.new);
          queryClient.invalidateQueries({ queryKey: queryKeys.allShoutCounts() });
          queryClient.invalidateQueries({ queryKey: queryKeys.allShouts() });
          // Trigger map refetches
          triggerShoutRefetch();
          triggerCountRefetch();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'shout_likes',
        },
        (payload) => {
          console.log('[EngagementRealtime] 🔔 Shout like DELETE received:', payload.old);
          queryClient.invalidateQueries({ queryKey: queryKeys.allShoutCounts() });
          queryClient.invalidateQueries({ queryKey: queryKeys.allShouts() });
          // Trigger map refetches
          triggerShoutRefetch();
          triggerCountRefetch();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'event_likes',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.allEvents() });
          // Trigger map refetches
          triggerEventRefetch();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'event_likes',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.allEvents() });
          // Trigger map refetches
          triggerEventRefetch();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'spot_comments',
        },
        (payload) => {
          // Helpful debug: if this never logs in prod, spot_comments isn't in supabase_realtime publication there.
          console.log('[EngagementRealtime] 🔔 Spot comment INSERT received:', payload.new);
          queryClient.invalidateQueries({ queryKey: queryKeys.allSpotComments() });
          queryClient.invalidateQueries({ queryKey: queryKeys.allEvents() });
          // Trigger map refetches
          triggerEventRefetch();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'spot_comments',
        },
        (payload) => {
          console.log('[EngagementRealtime] 🔔 Spot comment DELETE received:', payload.old);
          queryClient.invalidateQueries({ queryKey: queryKeys.allSpotComments() });
          queryClient.invalidateQueries({ queryKey: queryKeys.allEvents() });
          // Trigger map refetches
          triggerEventRefetch();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'spot_comment_likes',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.allSpotComments() });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'spot_comment_likes',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.allSpotComments() });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'shout_comment_likes',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.allShoutComments() });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'shout_comment_likes',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.allShoutComments() });
        }
      );
    
    // Subscribe to the channel
    channel.subscribe((status) => {
      console.log('[EngagementRealtime] 📡 Subscription status:', status);
      if (status === 'SUBSCRIBED') {
        console.log('[EngagementRealtime] ✅ Successfully subscribed to engagement realtime');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[EngagementRealtime] ❌ Channel subscription error');
      }
    });

    return () => {
      console.log('[EngagementRealtime] 🧹 Cleaning up engagement realtime listener');
      safeRemoveChannel(channel);
    };
  }, [queryClient, triggerShoutRefetch, triggerEventRefetch, triggerCountRefetch]);
};

