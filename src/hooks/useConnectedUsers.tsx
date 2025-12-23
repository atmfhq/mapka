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
}

/**
 * MMO-style hook: Returns ALL users with location set.
 * No invitation filtering - everyone sees everyone on the map.
 */
export const useConnectedUsers = (currentUserId: string) => {
  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);
  const [connectedUserIds, setConnectedUserIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Fetch ALL users with location (excluding current user)
  const fetchConnectedUsers = useCallback(async () => {
    if (!currentUserId) {
      console.log('[MMO] No currentUserId provided');
      setConnectedUsers([]);
      setConnectedUserIds(new Set());
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // Query ALL profiles with location set (MMO visibility)
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, nick, avatar_url, avatar_config, location_lat, location_lng, is_active, tags, bio')
        .not('location_lat', 'is', null)
        .not('location_lng', 'is', null)
        .eq('is_onboarded', true)
        .neq('id', currentUserId); // Exclude self

      if (error) {
        console.error('[MMO] Failed to fetch profiles:', error);
        setLoading(false);
        return;
      }

      console.log('[MMO] Fetched all users with location:', profiles?.length ?? 0);

      const mappedUsers: ConnectedUser[] = (profiles || []).map((p) => ({
        id: p.id,
        nick: p.nick || 'Anonymous',
        avatar_url: p.avatar_url || '',
        avatar_config: p.avatar_config as AvatarConfig | null,
        location_lat: p.location_lat!,
        location_lng: p.location_lng!,
        is_active: p.is_active,
        tags: p.tags,
        bio: p.bio,
      }));

      setConnectedUsers(mappedUsers);
      setConnectedUserIds(new Set(mappedUsers.map((u) => u.id)));
    } catch (err) {
      console.error('[MMO] Unexpected error:', err);
    }

    setLoading(false);
  }, [currentUserId]);

  // Initial fetch
  useEffect(() => {
    fetchConnectedUsers();
  }, [fetchConnectedUsers]);

  // Realtime subscription for ALL profile changes (MMO style)
  useEffect(() => {
    if (!currentUserId) return;

    console.log('[MMO] Setting up global profiles realtime subscription');

    const channel = supabase
      .channel('mmo-profiles-global')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'profiles',
        },
        (payload) => {
          const newRecord = payload.new as Record<string, any> | null;
          const oldRecord = payload.old as Record<string, any> | null;
          const recordId = newRecord?.id || oldRecord?.id;
          console.log('[MMO] Profile change received:', payload.eventType, recordId);

          if (payload.eventType === 'DELETE') {
            const oldRecord = payload.old as { id?: string } | null;
            const deletedId = oldRecord?.id;
            if (deletedId) {
              setConnectedUsers((prev) => prev.filter((u) => u.id !== deletedId));
              setConnectedUserIds((prev) => {
                const next = new Set(prev);
                next.delete(deletedId);
                return next;
              });
            }
            return;
          }

          const profile = payload.new as Record<string, any> | null;
          if (!profile) return;

          // Skip self
          if (profile.id === currentUserId) return;

          // Skip users without location or not onboarded
          if (!profile.location_lat || !profile.location_lng || !profile.is_onboarded) {
            // User lost location or not onboarded - remove from list
            setConnectedUsers((prev) => prev.filter((u) => u.id !== profile.id));
            setConnectedUserIds((prev) => {
              const next = new Set(prev);
              next.delete(profile.id);
              return next;
            });
            return;
          }

          const mappedUser: ConnectedUser = {
            id: profile.id,
            nick: profile.nick || 'Anonymous',
            avatar_url: profile.avatar_url || '',
            avatar_config: profile.avatar_config as AvatarConfig | null,
            location_lat: profile.location_lat,
            location_lng: profile.location_lng,
            is_active: profile.is_active,
            tags: profile.tags,
            bio: profile.bio,
          };

          setConnectedUsers((prev) => {
            const exists = prev.some((u) => u.id === profile.id);
            if (exists) {
              // Update existing
              return prev.map((u) => (u.id === profile.id ? mappedUser : u));
            }
            // Add new
            return [...prev, mappedUser];
          });

          setConnectedUserIds((prev) => {
            const next = new Set(prev);
            next.add(profile.id);
            return next;
          });
        }
      )
      .subscribe((status) => {
        console.log('[MMO] Global profiles subscription status:', status);
      });

    return () => {
      console.log('[MMO] Cleaning up global profiles subscription');
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  // Legacy functions - kept for compatibility but simplified
  const disconnectUser = async (_invitationId: string) => {
    // No-op in MMO mode - no invitations to cancel
    console.log('[MMO] disconnectUser called - no-op in MMO mode');
    return { error: null };
  };

  const getMissionIdForUser = (_userId: string): string | null => {
    // No missions in MMO mode
    return null;
  };

  const getInvitationIdForUser = (_userId: string): string | undefined => {
    // No invitations in MMO mode
    return undefined;
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
