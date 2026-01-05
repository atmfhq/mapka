import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { getOrCreateChannel, safeRemoveChannel } from '@/lib/realtimeUtils';

interface BannedUser {
  id: string;
  user_id: string;
  created_at: string;
  profile?: {
    id: string;
    nick: string;
    avatar_config: any;
  };
}

export const useSpotBans = (eventId: string | null, isHost: boolean) => {
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchBannedUsers = useCallback(async () => {
    if (!eventId || !isHost) {
      setBannedUsers([]);
      return;
    }

    const { data, error } = await supabase
      .from('spot_bans')
      .select('id, user_id, created_at')
      .eq('event_id', eventId);

    if (error) {
      console.error('Error fetching banned users:', error);
      return;
    }

    if (data && data.length > 0) {
      const userIds = data.map(b => b.user_id);
      const { data: profiles } = await supabase
        .rpc('get_public_profiles_by_ids', { user_ids: userIds });

      const bannedWithProfiles = data.map(ban => ({
        ...ban,
        profile: profiles?.find(p => p.id === ban.user_id),
      }));

      setBannedUsers(bannedWithProfiles);
    } else {
      setBannedUsers([]);
    }
  }, [eventId, isHost]);

  useEffect(() => {
    fetchBannedUsers();
  }, [fetchBannedUsers]);

  // Real-time subscription for ban changes
  useEffect(() => {
    if (!eventId || !isHost) return;

    const channelName = `spot-bans-${eventId}`;
    const { channel, shouldSubscribe } = getOrCreateChannel(channelName);
    
    if (!shouldSubscribe) {
      return;
    }
    
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'spot_bans',
        filter: `event_id=eq.${eventId}`,
      },
      () => {
        fetchBannedUsers();
      }
    );
    
    channel.subscribe();

    return () => {
      safeRemoveChannel(channel);
    };
  }, [eventId, isHost, fetchBannedUsers]);

  const banUser = async (userId: string, currentUserId: string) => {
    if (!eventId) return false;
    setLoading(true);

    try {
      // First, remove user from participants (kick)
      const { error: kickError } = await supabase
        .from('event_participants')
        .delete()
        .eq('event_id', eventId)
        .eq('user_id', userId);

      if (kickError) {
        throw kickError;
      }

      // Then add to ban list
      const { error: banError } = await supabase
        .from('spot_bans')
        .insert({
          event_id: eventId,
          user_id: userId,
          banned_by: currentUserId,
        });

      if (banError) {
        throw banError;
      }

      toast({
        title: "User removed and banned",
        description: "They can no longer join this spot.",
      });

      await fetchBannedUsers();
      return true;
    } catch (error: any) {
      toast({
        title: "Failed to ban user",
        description: error.message,
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const unbanUser = async (banId: string) => {
    setLoading(true);

    try {
      const { error } = await supabase
        .from('spot_bans')
        .delete()
        .eq('id', banId);

      if (error) {
        throw error;
      }

      toast({
        title: "User unbanned",
        description: "They can now join this spot again.",
      });

      await fetchBannedUsers();
      return true;
    } catch (error: any) {
      toast({
        title: "Failed to unban user",
        description: error.message,
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const checkIfBanned = async (eventId: string, userId: string): Promise<boolean> => {
    const { data, error } = await supabase
      .rpc('is_banned_from_event', { p_event_id: eventId, p_user_id: userId });

    if (error) {
      console.error('Error checking ban status:', error);
      return false;
    }

    return data === true;
  };

  return {
    bannedUsers,
    loading,
    banUser,
    unbanUser,
    checkIfBanned,
    refreshBans: fetchBannedUsers,
  };
};
