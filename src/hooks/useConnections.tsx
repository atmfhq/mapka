import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AvatarConfig {
  skinColor?: string;
  shape?: string;
  eyes?: string;
  mouth?: string;
}

interface ConnectedUser {
  id: string;
  nick: string | null;
  avatar_url: string | null;
  avatar_config: AvatarConfig | null;
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

        if (!connectionRows || connectionRows.length === 0) {
          setConnections([]);
          setLoading(false);
          return;
        }

        // Extract the other user's ID from each connection
        const otherUserIds = connectionRows.map(conn => 
          conn.user_a_id === currentUserId ? conn.user_b_id : conn.user_a_id
        );

        // Fetch profiles for connected users
        const { data: profiles, error: profilesError } = await supabase
          .rpc('get_public_profiles_by_ids', { user_ids: otherUserIds });

        if (profilesError) throw profilesError;

        const connectedUsers: ConnectedUser[] = (profiles || []).map((p: any) => ({
          id: p.id,
          nick: p.nick,
          avatar_url: p.avatar_url,
          avatar_config: p.avatar_config as AvatarConfig | null,
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

    // Subscribe to realtime changes on connections table
    const channel = supabase
      .channel(`connections-${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'connections',
        },
        () => {
          // Refetch when connections change
          fetchConnections();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  return { connections, loading, error };
};
