import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface PublicProfile {
  id: string;
  nick: string;
  avatar_url: string;
  avatar_config: unknown;
  bio: string;
  tags: string[];
  location_lat: number;
  location_lng: number;
  is_active: boolean;
}

interface PendingInvitation {
  id: string;
  sender_id: string;
  activity_type: string;
  created_at: string;
  sender?: PublicProfile;
}

export const useInvitationRealtime = (currentUserId: string | null) => {
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPendingInvitations = useCallback(async () => {
    if (!currentUserId) {
      setPendingInvitations([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('invitations')
      .select('id, sender_id, activity_type, created_at')
      .eq('receiver_id', currentUserId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching pending invitations:', error);
      setLoading(false);
      return;
    }

    if (data && data.length > 0) {
      // Fetch sender profiles using secure RPC function
      const senderIds = [...new Set(data.map(inv => inv.sender_id))];
      const { data: profiles } = await supabase
        .rpc('get_public_profiles_by_ids', { user_ids: senderIds });

      const invitationsWithSenders = data.map(inv => ({
        ...inv,
        sender: profiles?.find(p => p.id === inv.sender_id),
      }));

      setPendingInvitations(invitationsWithSenders);
    } else {
      setPendingInvitations([]);
    }

    setLoading(false);
  }, [currentUserId]);

  // Initial fetch
  useEffect(() => {
    fetchPendingInvitations();
  }, [fetchPendingInvitations]);

  // Realtime subscription for RECEIVER (incoming invitations)
  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel('invitations-receiver-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'invitations',
          filter: `receiver_id=eq.${currentUserId}`,
        },
        async (payload) => {
          console.log('New invitation received:', payload);
          
          // Fetch sender profile using secure RPC function
          const { data: senderProfiles } = await supabase
            .rpc('get_public_profiles_by_ids', { user_ids: [payload.new.sender_id] });
          
          const senderProfile = senderProfiles?.[0];

          const newInvitation: PendingInvitation = {
            id: payload.new.id,
            sender_id: payload.new.sender_id,
            activity_type: payload.new.activity_type,
            created_at: payload.new.created_at,
            sender: senderProfile || undefined,
          };

          // Only add if it's pending
          if (payload.new.status === 'pending') {
            setPendingInvitations(prev => [newInvitation, ...prev]);

            // Show toast notification
            toast({
              title: '📡 New Signal Received!',
              description: `${senderProfile?.nick || 'Someone'} wants to connect for ${payload.new.activity_type}`,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'invitations',
          filter: `receiver_id=eq.${currentUserId}`,
        },
        (payload) => {
          console.log('Invitation updated (receiver):', payload);
          
          // Remove from pending if status changed from pending
          if (payload.new.status !== 'pending') {
            setPendingInvitations(prev => 
              prev.filter(inv => inv.id !== payload.new.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  // Realtime subscription for SENDER (invitation accepted notifications)
  useEffect(() => {
    if (!currentUserId) return;

    console.log('[InvitationRealtime] Setting up sender subscription for:', currentUserId);

    const channel = supabase
      .channel(`invitations-sender-${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'invitations',
          filter: `sender_id=eq.${currentUserId}`,
        },
        async (payload) => {
          console.log('[InvitationRealtime] Sender invitation UPDATE:', payload);
          
          const newRecord = payload.new as {
            id: string;
            sender_id: string;
            receiver_id: string;
            status: string;
            activity_type: string;
          };
          const oldRecord = payload.old as { status?: string } | null;
          
          // Check if the invitation was just accepted
          const isAccepted = newRecord.status === 'accepted';
          const wasNotAccepted = !oldRecord?.status || oldRecord.status === 'pending';
          
          console.log('[InvitationRealtime] Status transition:', { 
            oldStatus: oldRecord?.status,
            newStatus: newRecord.status,
            isAccepted,
            wasNotAccepted 
          });

          if (isAccepted && wasNotAccepted) {
            console.log('[InvitationRealtime] Invitation accepted! Showing toast...');
            
            // Fetch receiver profile using secure RPC function
            const { data: receiverProfiles } = await supabase
              .rpc('get_public_profiles_by_ids', { user_ids: [newRecord.receiver_id] });
            
            const receiverProfile = receiverProfiles?.[0];

            toast({
              title: '🎯 Signal Connected!',
              description: `${receiverProfile?.nick || 'Someone'} accepted your invitation. Check your chats!`,
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('[InvitationRealtime] Sender subscription status:', status);
      });

    return () => {
      console.log('[InvitationRealtime] Cleaning up sender subscription');
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const refetch = useCallback(() => {
    fetchPendingInvitations();
  }, [fetchPendingInvitations]);

  return {
    pendingInvitations,
    pendingCount: pendingInvitations.length,
    loading,
    refetch,
  };
};
