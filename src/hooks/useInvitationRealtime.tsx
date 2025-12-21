import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface PendingInvitation {
  id: string;
  sender_id: string;
  activity_type: string;
  created_at: string;
  sender?: {
    nick: string | null;
    avatar_url: string | null;
  };
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
      // Fetch sender profiles
      const senderIds = [...new Set(data.map(inv => inv.sender_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nick, avatar_url')
        .in('id', senderIds);

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
          
          // Fetch sender profile for the notification
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('nick, avatar_url')
            .eq('id', payload.new.sender_id)
            .single();

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

    const channel = supabase
      .channel('invitations-sender-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'invitations',
          filter: `sender_id=eq.${currentUserId}`,
        },
        async (payload) => {
          console.log('Invitation updated (sender):', payload);
          
          // Check if the invitation was just accepted
          if (payload.new.status === 'accepted' && payload.old?.status === 'pending') {
            // Fetch receiver profile for the notification
            const { data: receiverProfile } = await supabase
              .from('profiles')
              .select('nick')
              .eq('id', payload.new.receiver_id)
              .single();

            toast({
              title: '✅ Signal Accepted!',
              description: `You are now connected with ${receiverProfile?.nick || 'an operative'}.`,
            });
          }
        }
      )
      .subscribe();

    return () => {
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
