import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AvatarConfig {
  skinColor?: string;
  shape?: string;
  eyes?: string;
  mouth?: string;
}

interface ConnectedUser {
  id: string;
  nick: string;
  avatar_url: string;
  avatar_config: AvatarConfig | null;
  location_lat: number;
  location_lng: number;
  is_active: boolean;
  tags: string[] | null;
  bio: string | null;
  invitationId: string; // The invitation linking the two users
}

interface AcceptedInvitation {
  id: string;
  sender_id: string;
  receiver_id: string;
}

/**
 * Hook: Returns users that have an ACCEPTED invitation with the current user.
 * This is the actual "connected" state - not just map visibility.
 */
export const useConnectedUsers = (currentUserId: string) => {
  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);
  const [connectedUserIds, setConnectedUserIds] = useState<Set<string>>(new Set());
  const [invitationMap, setInvitationMap] = useState<Map<string, string>>(new Map()); // userId -> invitationId
  const [loading, setLoading] = useState(true);

  // Fetch users with ACCEPTED invitations (actual connections)
  const fetchConnectedUsers = useCallback(async () => {
    if (!currentUserId) {
      setConnectedUsers([]);
      setConnectedUserIds(new Set());
      setInvitationMap(new Map());
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // Query invitations where current user is sender OR receiver and status is 'accepted'
      const { data: invitations, error: invError } = await supabase
        .from('invitations')
        .select('id, sender_id, receiver_id')
        .eq('status', 'accepted')
        .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`);

      if (invError) {
        console.error('[Connections] Failed to fetch accepted invitations:', invError);
        setLoading(false);
        return;
      }

      if (!invitations || invitations.length === 0) {
        console.log('[Connections] No accepted invitations found');
        setConnectedUsers([]);
        setConnectedUserIds(new Set());
        setInvitationMap(new Map());
        setLoading(false);
        return;
      }

      // Build map of connected user IDs to invitation IDs
      const userToInvitation = new Map<string, string>();
      const connectedIds: string[] = [];
      
      for (const inv of invitations) {
        const otherId = inv.sender_id === currentUserId ? inv.receiver_id : inv.sender_id;
        userToInvitation.set(otherId, inv.id);
        connectedIds.push(otherId);
      }

      console.log('[Connections] Found accepted connections:', connectedIds.length);

      // Fetch profiles for connected users
      if (connectedIds.length > 0) {
        const { data: profiles, error: profError } = await supabase
          .rpc('get_public_profiles_by_ids', { user_ids: connectedIds });

        if (profError) {
          console.error('[Connections] Failed to fetch connected user profiles:', profError);
          setLoading(false);
          return;
        }

        const mappedUsers: ConnectedUser[] = (profiles || []).map((p: any) => ({
          id: p.id,
          nick: p.nick || 'Anonymous',
          avatar_url: p.avatar_url || '',
          avatar_config: p.avatar_config as AvatarConfig | null,
          location_lat: p.location_lat ?? 0,
          location_lng: p.location_lng ?? 0,
          is_active: p.is_active,
          tags: p.tags,
          bio: p.bio,
          invitationId: userToInvitation.get(p.id) || '',
        }));

        setConnectedUsers(mappedUsers);
        setConnectedUserIds(new Set(mappedUsers.map((u) => u.id)));
        setInvitationMap(userToInvitation);
      } else {
        setConnectedUsers([]);
        setConnectedUserIds(new Set());
        setInvitationMap(new Map());
      }
    } catch (err) {
      console.error('[Connections] Unexpected error:', err);
    }

    setLoading(false);
  }, [currentUserId]);

  // Initial fetch
  useEffect(() => {
    fetchConnectedUsers();
  }, [fetchConnectedUsers]);

  // Realtime subscription for invitation changes - using broad subscription for reliability
  // Note: Column filters (sender_id=eq.X) may not work reliably in all Supabase versions
  // Using a broad subscription with client-side filtering is more robust
  useEffect(() => {
    if (!currentUserId) return;

    console.log('[Connections] Setting up realtime subscription for user:', currentUserId);

    const channel = supabase
      .channel(`connections-invitations-${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'invitations',
        },
        (payload) => {
          const newInv = payload.new as { sender_id: string; receiver_id: string };
          // Check if this invitation involves the current user
          if (newInv.sender_id === currentUserId || newInv.receiver_id === currentUserId) {
            console.log('[Connections] New invitation involving current user:', payload);
            fetchConnectedUsers();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'invitations',
        },
        (payload) => {
          const updatedInv = payload.new as { sender_id: string; receiver_id: string; status: string };
          // Check if this invitation involves the current user
          if (updatedInv.sender_id === currentUserId || updatedInv.receiver_id === currentUserId) {
            console.log('[Connections] Invitation updated for current user:', updatedInv.status, payload);
            // Refetch immediately for instant UI update
            fetchConnectedUsers();
          }
        }
      )
      .subscribe((status) => {
        console.log('[Connections] Invitation subscription status:', status);
      });

    return () => {
      console.log('[Connections] Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [currentUserId, fetchConnectedUsers]);

  // Disconnect user by cancelling the invitation
  const disconnectUser = async (invitationId: string) => {
    if (!invitationId) {
      console.error('[Connections] No invitation ID provided for disconnect');
      return { error: new Error('No invitation ID') };
    }

    const { error } = await supabase
      .from('invitations')
      .update({ status: 'cancelled' })
      .eq('id', invitationId);

    if (error) {
      console.error('[Connections] Failed to disconnect:', error);
      return { error };
    }

    // Refetch to update state
    await fetchConnectedUsers();
    return { error: null };
  };

  // Get the invitation ID for a specific user (if connected)
  const getInvitationIdForUser = (userId: string): string | undefined => {
    return invitationMap.get(userId);
  };

  // Legacy function - kept for compatibility
  const getMissionIdForUser = (_userId: string): string | null => {
    return null;
  };

  return {
    connectedUsers,
    connectedUserIds,
    disconnectUser,
    getMissionIdForUser,
    getInvitationIdForUser,
    loading,
    refetch: fetchConnectedUsers,
  };
};
