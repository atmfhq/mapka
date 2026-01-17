import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getOrCreateChannel, safeRemoveChannel } from '@/lib/realtimeUtils';

interface AvatarConfig {
  skinColor?: string;
  shape?: string;
  eyes?: string;
  mouth?: string;
}

export interface ConnectedUser {
  id: string;
  nick: string | null;
  avatar_url: string | null;
  avatar_config: AvatarConfig | null;
  location_lat: number | null;
  location_lng: number | null;
  tags: string[] | null;
  bio: string | null;
  invitationId: string | null;
}

export const useConnections = (currentUserId: string | null) => {
  const [connections, setConnections] = useState<ConnectedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConnections = useCallback(async () => {
    if (!currentUserId) {
      setConnections([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // SINGLE SOURCE OF TRUTH: Only fetch users with accepted invitations (status === 'accepted')
      // This ensures consistency with Map and Profile views
      const { data: invitationRows, error: invError } = await supabase
        .from('invitations')
        .select('id, sender_id, receiver_id')
        .eq('status', 'accepted')
        .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`);

      if (invError) throw invError;

      // Build a map of user ID -> invitation ID
      const invitationIdMap = new Map<string, string>();
      const userIdSet = new Set<string>();

      // Only process accepted invitations
      (invitationRows || []).forEach(inv => {
        const otherId = inv.sender_id === currentUserId ? inv.receiver_id : inv.sender_id;
        invitationIdMap.set(otherId, inv.id);
        userIdSet.add(otherId);
      });

      const otherUserIds = Array.from(userIdSet);

      if (otherUserIds.length === 0) {
        setConnections([]);
        setLoading(false);
        return;
      }

      // Fetch profiles for connected users (includes tags and bio)
      const { data: profiles, error: profilesError } = await supabase
        .rpc('get_public_profiles_by_ids', { user_ids: otherUserIds });

      if (profilesError) throw profilesError;

      const connectedUsers: ConnectedUser[] = (profiles || []).map((p: any) => ({
        id: p.id,
        nick: p.nick,
        avatar_url: p.avatar_url,
        avatar_config: p.avatar_config as AvatarConfig | null,
        location_lat: p.location_lat,
        location_lng: p.location_lng,
        tags: p.tags || null,
        bio: p.bio || null,
        invitationId: invitationIdMap.get(p.id) || null,
      }));

      setConnections(connectedUsers);
    } catch (err: any) {
      console.error('Failed to fetch connections:', err);
      setError(err.message || 'Failed to load connections');
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  // Use ref to avoid re-subscribing when fetchConnections changes
  const fetchRef = useRef(fetchConnections);
  useEffect(() => {
    fetchRef.current = fetchConnections;
  }, [fetchConnections]);

  // Debounce refetch to prevent race conditions and rapid successive calls
  const refetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const debouncedRefetch = useCallback(() => {
    // Clear any pending refetch
    if (refetchTimeoutRef.current) {
      clearTimeout(refetchTimeoutRef.current);
    }
    // Schedule refetch with delay to ensure DB commit completes
    refetchTimeoutRef.current = setTimeout(() => {
      fetchRef.current();
      refetchTimeoutRef.current = null;
    }, 300); // 300ms delay to ensure database commit and propagation
  }, []);

  useEffect(() => {
    if (!currentUserId) {
      setConnections([]);
      setLoading(false);
      return;
    }

    fetchConnections();

    // Subscribe to realtime changes on connections and invitations
    // GLOBAL subscription pattern (no filter) - use stable channel name
    const channelName = `connections-global-${currentUserId}`;
    
    // Check if channel already exists to prevent CHANNEL_ERROR
    const { channel: connectionsChannel, shouldSubscribe } = getOrCreateChannel(channelName);
    
    if (!shouldSubscribe) {
      console.log('[Connections] Channel already subscribed:', channelName);
      return;
    }
    
    console.log('[Connections] Setting up GLOBAL realtime channel:', channelName);
    connectionsChannel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'invitations',
          // NO FILTER - listen globally, filter in handler
        },
        (payload) => {
          const updatedInv = payload.new as {
            sender_id: string;
            receiver_id: string;
            status: string;
          };
          const oldInv = payload.old as { status?: string } | null;
          
          // CLIENT-SIDE FILTERING: Only process if this invitation involves the current user
          if (updatedInv.sender_id !== currentUserId && updatedInv.receiver_id !== currentUserId) {
            return;
          }
          
          // Handle status changes: accepted (new connection) or cancelled (disconnect)
          const wasAccepted = oldInv?.status === 'accepted';
          const isNowAccepted = updatedInv.status === 'accepted';
          const isNowCancelled = updatedInv.status === 'cancelled';
          
          // Refetch if:
          // 1. Status changed to 'accepted' (new connection)
          // 2. Status changed to 'cancelled' (disconnect)
          if ((isNowAccepted && !wasAccepted) || (isNowCancelled && wasAccepted)) {
            console.log('[Connections] Invitation status changed via realtime, scheduling refetch:', {
              oldStatus: oldInv?.status,
              newStatus: updatedInv.status,
            });
            // Use debounced refetch to ensure DB commit completes
            debouncedRefetch();
          }
        }
      )
    connectionsChannel.subscribe((status) => {
      console.log('[Connections] Subscription status:', status);
      if (status === 'SUBSCRIBED') {
        console.log('[Connections] ✅ Successfully subscribed to realtime');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[Connections] ❌ Channel error - subscription failed');
      }
    });

    return () => {
      safeRemoveChannel(connectionsChannel);
      // Clear any pending refetch on cleanup
      if (refetchTimeoutRef.current) {
        clearTimeout(refetchTimeoutRef.current);
        refetchTimeoutRef.current = null;
      }
    };
  }, [currentUserId, debouncedRefetch]);

  // Optimistically remove a connection from the list
  const removeConnection = useCallback((userId: string) => {
    setConnections(prev => prev.filter(conn => conn.id !== userId));
  }, []);

  return { connections, loading, error, refetch: fetchConnections, removeConnection };
};
