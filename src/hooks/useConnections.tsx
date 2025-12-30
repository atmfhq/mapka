import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

  useEffect(() => {
    if (!currentUserId) {
      setConnections([]);
      setLoading(false);
      return;
    }

    const fetchConnections = async () => {
      setLoading(true);
      setError(null);

      try {
        // Get all connections where current user is either user_a or user_b
        const { data: connectionRows, error: connError } = await supabase
          .from('connections')
          .select('user_a_id, user_b_id')
          .or(`user_a_id.eq.${currentUserId},user_b_id.eq.${currentUserId}`);

        if (connError) throw connError;

        // Also get accepted invitations (DM connections) - include id for invitationId
        const { data: invitationRows, error: invError } = await supabase
          .from('invitations')
          .select('id, sender_id, receiver_id')
          .eq('status', 'accepted')
          .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`);

        if (invError) throw invError;

        // Build a map of user ID -> invitation ID
        const invitationIdMap = new Map<string, string>();
        (invitationRows || []).forEach(inv => {
          const otherId = inv.sender_id === currentUserId ? inv.receiver_id : inv.sender_id;
          invitationIdMap.set(otherId, inv.id);
        });

        // Collect unique user IDs from both sources
        const userIdSet = new Set<string>();

        // From connections table
        (connectionRows || []).forEach(conn => {
          const otherId = conn.user_a_id === currentUserId ? conn.user_b_id : conn.user_a_id;
          userIdSet.add(otherId);
        });

        // From accepted invitations
        (invitationRows || []).forEach(inv => {
          const otherId = inv.sender_id === currentUserId ? inv.receiver_id : inv.sender_id;
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
    };

    fetchConnections();

    // Subscribe to realtime changes on connections and invitations
    const connectionsChannel = supabase
      .channel(`connections-${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'connections',
        },
        () => fetchConnections()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'invitations',
        },
        () => fetchConnections()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(connectionsChannel);
    };
  }, [currentUserId]);

  return { connections, loading, error, refetch: () => {} };
};
