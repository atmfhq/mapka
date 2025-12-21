import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ConnectedUser {
  id: string;
  nick: string | null;
  avatar_url: string | null;
  invitationId: string;
}

export const useConnectedUsers = (currentUserId: string) => {
  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);
  const [connectedUserIds, setConnectedUserIds] = useState<Set<string>>(new Set());

  const fetchConnectedUsers = useCallback(async () => {
    if (!currentUserId) return;

    // Get accepted invitations where current user is involved
    const { data: invitations } = await supabase
      .from('invitations')
      .select('id, sender_id, receiver_id')
      .eq('status', 'accepted')
      .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`);

    if (!invitations || invitations.length === 0) {
      setConnectedUsers([]);
      setConnectedUserIds(new Set());
      return;
    }

    // Get the other user IDs from the invitations
    const otherUserIds = invitations.map(inv => 
      inv.sender_id === currentUserId ? inv.receiver_id : inv.sender_id
    );

    // Fetch their profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, nick, avatar_url')
      .in('id', otherUserIds);

    if (profiles) {
      const connected = profiles.map(profile => {
        const invitation = invitations.find(inv => 
          inv.sender_id === profile.id || inv.receiver_id === profile.id
        );
        return {
          ...profile,
          invitationId: invitation?.id || '',
        };
      });
      setConnectedUsers(connected);
      setConnectedUserIds(new Set(profiles.map(p => p.id)));
    }
  }, [currentUserId]);

  useEffect(() => {
    fetchConnectedUsers();
  }, [fetchConnectedUsers]);

  // Subscribe to invitation changes
  useEffect(() => {
    const channel = supabase
      .channel('connected-users')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invitations' },
        () => {
          fetchConnectedUsers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchConnectedUsers]);

  const disconnectUser = async (invitationId: string) => {
    const { error } = await supabase
      .from('invitations')
      .update({ status: 'cancelled' })
      .eq('id', invitationId);

    if (!error) {
      fetchConnectedUsers();
    }
    return { error };
  };

  return {
    connectedUsers,
    connectedUserIds,
    disconnectUser,
    refetch: fetchConnectedUsers,
  };
};
