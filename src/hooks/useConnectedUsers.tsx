import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  invitationId: string;
}

/**
 * Hook: Returns users that have an ACCEPTED invitation with the current user.
 * Optimized to prevent duplicate fetches and unnecessary re-renders.
 */
export const useConnectedUsers = (currentUserId: string) => {
  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);
  const [invitationMap, setInvitationMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  
  // Track fetch state to prevent duplicate requests
  const isFetchingRef = useRef(false);
  const hasFetchedRef = useRef(false);

  // Memoize connectedUserIds to prevent unnecessary re-renders
  const connectedUserIds = useMemo(() => {
    return new Set(connectedUsers.map(u => u.id));
  }, [connectedUsers]);

  const fetchConnectedUsers = useCallback(async () => {
    if (!currentUserId) {
      setConnectedUsers([]);
      setInvitationMap(new Map());
      setLoading(false);
      return;
    }

    // Prevent duplicate concurrent fetches
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    
    if (!hasFetchedRef.current) {
      setLoading(true);
    }

    try {
      const { data: invitations, error: invError } = await supabase
        .from('invitations')
        .select('id, sender_id, receiver_id')
        .eq('status', 'accepted')
        .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`);

      if (invError) {
        console.error('[Connections] Failed to fetch:', invError);
        return;
      }

      if (!invitations || invitations.length === 0) {
        setConnectedUsers([]);
        setInvitationMap(new Map());
        return;
      }

      const userToInvitation = new Map<string, string>();
      const connectedIds: string[] = [];
      
      for (const inv of invitations) {
        const otherId = inv.sender_id === currentUserId ? inv.receiver_id : inv.sender_id;
        userToInvitation.set(otherId, inv.id);
        connectedIds.push(otherId);
      }

      if (connectedIds.length > 0) {
        const { data: profiles, error: profError } = await supabase
          .rpc('get_public_profiles_by_ids', { user_ids: connectedIds });

        if (profError) {
          console.error('[Connections] Failed to fetch profiles:', profError);
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
        setInvitationMap(userToInvitation);
      } else {
        setConnectedUsers([]);
        setInvitationMap(new Map());
      }
    } catch (err) {
      console.error('[Connections] Unexpected error:', err);
    } finally {
      isFetchingRef.current = false;
      hasFetchedRef.current = true;
      setLoading(false);
    }
  }, [currentUserId]);

  // Initial fetch - only once
  useEffect(() => {
    if (!hasFetchedRef.current) {
      fetchConnectedUsers();
    }
  }, [fetchConnectedUsers]);

  // Realtime subscription - uses ref to avoid resubscribing
  const fetchRef = useRef(fetchConnectedUsers);
  useEffect(() => { fetchRef.current = fetchConnectedUsers; }, [fetchConnectedUsers]);

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel(`connections-${currentUserId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'invitations' },
        (payload) => {
          const inv = payload.new as { sender_id: string; receiver_id: string };
          if (inv.sender_id === currentUserId || inv.receiver_id === currentUserId) {
            fetchRef.current();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'invitations' },
        (payload) => {
          const inv = payload.new as { sender_id: string; receiver_id: string };
          if (inv.sender_id === currentUserId || inv.receiver_id === currentUserId) {
            fetchRef.current();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const disconnectUser = useCallback(async (invitationId: string) => {
    if (!invitationId) {
      return { error: new Error('No invitation ID') };
    }

    const { error } = await supabase
      .from('invitations')
      .update({ status: 'cancelled' })
      .eq('id', invitationId);

    if (error) {
      return { error };
    }

    await fetchConnectedUsers();
    return { error: null };
  }, [fetchConnectedUsers]);

  const getInvitationIdForUser = useCallback((userId: string): string | undefined => {
    return invitationMap.get(userId);
  }, [invitationMap]);

  const getMissionIdForUser = useCallback((_userId: string): string | null => {
    return null;
  }, []);

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
