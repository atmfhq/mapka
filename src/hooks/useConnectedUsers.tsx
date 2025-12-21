import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ConnectedUser {
  id: string;
  nick: string | null;
  avatar_url: string | null;
  invitationId: string;
  missionId: string | null;
}

export const useConnectedUsers = (currentUserId: string) => {
  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);
  const [connectedUserIds, setConnectedUserIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchConnectedUsers = useCallback(async () => {
    if (!currentUserId) {
      console.log('useConnectedUsers: No currentUserId provided');
      return;
    }

    setLoading(true);

    try {
      // Get accepted invitations where current user is involved (either as sender or receiver)
      const { data: invitations, error: invError } = await supabase
        .from('invitations')
        .select('id, sender_id, receiver_id, status')
        .eq('status', 'accepted');

      console.log('useConnectedUsers: All accepted invitations:', invitations, 'Error:', invError);

      if (invError) {
        console.error('Failed to fetch invitations:', invError);
        setLoading(false);
        return;
      }

      // Filter to only include invitations where current user is involved
      const myInvitations = invitations?.filter(inv => 
        inv.sender_id === currentUserId || inv.receiver_id === currentUserId
      ) || [];

      console.log('useConnectedUsers: My invitations:', myInvitations, 'currentUserId:', currentUserId);

      if (myInvitations.length === 0) {
        console.log('useConnectedUsers: No accepted invitations found for user');
        setConnectedUsers([]);
        setConnectedUserIds(new Set());
        setLoading(false);
        return;
      }

      // Get the other user IDs from the invitations
      const otherUserData = myInvitations.map(inv => ({
        oderId: inv.sender_id === currentUserId ? inv.receiver_id : inv.sender_id,
        invitationId: inv.id,
      }));

      const otherUserIds = otherUserData.map(d => d.oderId);
      console.log('useConnectedUsers: Other user IDs:', otherUserIds);

      // Fetch their profiles
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, nick, avatar_url')
        .in('id', otherUserIds);

      console.log('useConnectedUsers: Fetched profiles:', profiles, 'Error:', profileError);

      if (profileError) {
        console.error('Failed to fetch profiles:', profileError);
        setLoading(false);
        return;
      }

      // Find associated private missions for each connection
      // When invite is accepted, receiver becomes host of a private megaphone
      // and sender is added as participant
      const connectedWithMissions: ConnectedUser[] = [];

      for (const profile of profiles || []) {
        const invData = otherUserData.find(d => d.oderId === profile.id);
        
        // Find the private mission between these two users
        // Check megaphones where either user is host and both are participants
        const { data: missions } = await supabase
          .from('megaphones')
          .select('id, host_id')
          .eq('is_private', true)
          .or(`host_id.eq.${currentUserId},host_id.eq.${profile.id}`);

        let missionId: string | null = null;

        if (missions?.length) {
          // Find one where both users are involved
          for (const mission of missions) {
            const { data: participants } = await supabase
              .from('event_participants')
              .select('user_id')
              .eq('event_id', mission.id)
              .eq('status', 'joined');

            const participantIds = participants?.map(p => p.user_id) || [];
            const allInvolved = [mission.host_id, ...participantIds];
            
            if (allInvolved.includes(currentUserId) && allInvolved.includes(profile.id)) {
              missionId = mission.id;
              break;
            }
          }
        }

        connectedWithMissions.push({
          ...profile,
          invitationId: invData?.invitationId || '',
          missionId,
        });
      }

      console.log('useConnectedUsers: Final connected users:', connectedWithMissions);
      
      setConnectedUsers(connectedWithMissions);
      setConnectedUserIds(new Set(connectedWithMissions.map(p => p.id)));
    } catch (err) {
      console.error('useConnectedUsers: Unexpected error:', err);
    }
    
    setLoading(false);
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
          console.log('useConnectedUsers: Invitation change detected, refetching...');
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

  const getMissionIdForUser = (userId: string): string | null => {
    const user = connectedUsers.find(u => u.id === userId);
    return user?.missionId || null;
  };

  const getInvitationIdForUser = (userId: string): string | undefined => {
    const user = connectedUsers.find(u => u.id === userId);
    return user?.invitationId;
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
