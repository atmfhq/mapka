import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { getOrCreateChannel, safeRemoveChannel } from '@/lib/realtimeUtils';

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
  
  // Track which invitation IDs have already shown toasts to prevent duplicates
  const shownToastInvitationIdsRef = useRef<Set<string>>(new Set());
  
  // Track which accepted invitations have already notified the sender
  const notifiedAcceptedInvitationIdsRef = useRef<Set<string>>(new Set());

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

  // Use ref to avoid re-subscribing when fetchPendingInvitations changes
  const fetchPendingInvitationsRef = useRef(fetchPendingInvitations);
  useEffect(() => {
    fetchPendingInvitationsRef.current = fetchPendingInvitations;
  }, [fetchPendingInvitations]);

  // Real-time subscription for RECEIVER (incoming invitations)
  // GLOBAL subscription pattern: stable channel name, client-side filtering
  useEffect(() => {
    if (!currentUserId) return;

    // Use stable channel name with userId (no Date.now() to prevent recreations)
    const channelName = `invitations-receiver-${currentUserId}`;
    
    // Check if channel already exists to prevent CHANNEL_ERROR
    const { channel, shouldSubscribe } = getOrCreateChannel(channelName);
    
    if (!shouldSubscribe) {
      console.log('[InvitationRealtime] Receiver channel already subscribed:', channelName);
      return;
    }
    
    console.log('[InvitationRealtime] Setting up realtime subscription:', channelName);
    
    channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'invitations',
          // NO SERVER-SIDE FILTER - use client-side filtering like Notifications does
        },
        async (payload) => {
          const newInv = payload.new as {
            id: string;
            sender_id: string;
            receiver_id: string;
            status: string;
            activity_type: string;
            created_at: string;
          };
          
          // CLIENT-SIDE FILTERING (like Notifications does with recipient_id check)
          // Only process invitations for the current user as receiver
          if (newInv.receiver_id !== currentUserId) {
            return;
          }
          
          console.log('[InvitationRealtime] New invitation received via realtime:', newInv.id);
          
          // Only process if it's pending
          if (newInv.status === 'pending') {
            // Check if we've already shown a toast for this invitation (deduplication)
            if (shownToastInvitationIdsRef.current.has(newInv.id)) {
              console.log('[InvitationRealtime] Skipping duplicate toast for invitation:', newInv.id);
              return;
            }
            
            // Mark this invitation as having shown a toast
            shownToastInvitationIdsRef.current.add(newInv.id);
            
            // Add to state immediately (prepend to array) - this triggers red dot instantly
            // Create invitation object without profile first for instant UI update
            const newInvitation: PendingInvitation = {
              id: newInv.id,
              sender_id: newInv.sender_id,
              activity_type: newInv.activity_type,
              created_at: newInv.created_at,
            };

            setPendingInvitations(prev => {
              // Check for duplicates
              if (prev.some(inv => inv.id === newInvitation.id)) {
                return prev;
              }
              return [newInvitation, ...prev];
            });

            // Fetch sender profile in background and show toast once we have it
            // ONLY show toast for real-time events (this is a realtime INSERT handler)
            (async () => {
              try {
                const { data: senderProfiles } = await supabase
                  .rpc('get_public_profiles_by_ids', { user_ids: [newInv.sender_id] });
                
                const senderProfile = senderProfiles?.[0];

                // Update the invitation with profile data
                if (senderProfile) {
                  setPendingInvitations(prev => 
                    prev.map(inv => 
                      inv.id === newInvitation.id 
                        ? { ...inv, sender: senderProfile }
                        : inv
                    )
                  );
                }

                // Show toast notification - this is a real-time event, so it's appropriate
                toast({
                  title: '📡 Connection Request!',
                  description: `${senderProfile?.nick || 'Someone'} wants to connect with you.`,
                });
              } catch (error) {
                console.error('[InvitationRealtime] Error fetching sender profile:', error);
                // Show generic toast if profile fetch fails
                toast({
                  title: '📡 Connection Request!',
                  description: 'Someone wants to connect with you.',
                });
              }
            })();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'invitations',
          // NO SERVER-SIDE FILTER - use client-side filtering
        },
        (payload) => {
          const updatedInv = payload.new as { id: string; receiver_id: string; status: string };
          
          // CLIENT-SIDE FILTERING
          // Only process if current user is the receiver
          if (updatedInv.receiver_id !== currentUserId) {
            return;
          }
          
          console.log('[InvitationRealtime] Invitation updated via realtime:', updatedInv.id);
          
          // Remove from pending if status changed from pending
          if (updatedInv.status !== 'pending') {
            setPendingInvitations(prev => 
              prev.filter(inv => inv.id !== updatedInv.id)
            );
          }
        }
      )
    channel.subscribe((status) => {
      console.log('[InvitationRealtime] Subscription status:', status);
      if (status === 'SUBSCRIBED') {
        console.log('[InvitationRealtime] ✅ Successfully subscribed');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[InvitationRealtime] Channel error - subscription failed');
      }
    });

    return () => {
      console.log('[InvitationRealtime] Cleaning up subscription:', channelName);
      safeRemoveChannel(channel);
    };
  }, [currentUserId]);

  // Realtime subscription for SENDER (invitation accepted notifications)
  // Using stable channel name with userId
  useEffect(() => {
    if (!currentUserId) return;

    const channelName = `invitations-sender-accept-${currentUserId}`;
    
    // Check if channel already exists to prevent CHANNEL_ERROR
    const { channel: senderChannel, shouldSubscribe } = getOrCreateChannel(channelName);
    
    if (!shouldSubscribe) {
      console.log('[InvitationRealtime] Sender channel already subscribed:', channelName);
      return;
    }
    
    console.log('[InvitationRealtime] Setting up sender acceptance subscription:', channelName);

    senderChannel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'invitations',
        },
        async (payload) => {
          const newRecord = payload.new as {
            id: string;
            sender_id: string;
            receiver_id: string;
            status: string;
          };
          const oldRecord = payload.old as { status?: string; sender_id?: string } | null;
          
          // Only process if current user is the sender
          if (newRecord.sender_id !== currentUserId) return;
          
          console.log('[InvitationRealtime] Sender invitation UPDATE:', payload);
          
          // Check if the invitation was just accepted.
          // IMPORTANT: Some UPDATE payloads may not include `old.status` (or `payload.old` may be null),
          // e.g. when other fields (like last_read_at) change. In that case, we must NOT emit the toast.
          const oldStatus = oldRecord?.status;
          const newStatus = newRecord.status;
          const isAccepted = newStatus === 'accepted';
          const isStatusTransitionToAccepted = Boolean(oldStatus) && oldStatus !== 'accepted' && isAccepted;
          
          console.log('[InvitationRealtime] Status transition:', { 
            oldStatus,
            newStatus,
            isAccepted,
            isStatusTransitionToAccepted,
          });

          if (isStatusTransitionToAccepted) {
            // Deduplication: Check if we've already notified about this acceptance
            if (notifiedAcceptedInvitationIdsRef.current.has(newRecord.id)) {
              console.log('[InvitationRealtime] Skipping duplicate acceptance toast for invitation:', newRecord.id);
              return;
            }
            
            // Mark this invitation as having been notified
            notifiedAcceptedInvitationIdsRef.current.add(newRecord.id);
            
            console.log('[InvitationRealtime] Invitation accepted! Showing toast...');
            
            // Fetch receiver profile using secure RPC function
            const { data: receiverProfiles } = await supabase
              .rpc('get_public_profiles_by_ids', { user_ids: [newRecord.receiver_id] });
            
            const receiverProfile = receiverProfiles?.[0];

            // Show toast - this is a real-time event for the sender
            toast({
              title: '🎯 Connected!',
              description: `${receiverProfile?.nick || 'Someone'} accepted your request. Check your chats!`,
            });
          }
        }
      )
    senderChannel.subscribe((status) => {
      console.log('[InvitationRealtime] Sender acceptance subscription status:', status);
      if (status === 'SUBSCRIBED') {
        console.log('[InvitationRealtime] ✅ Sender subscription connected');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[InvitationRealtime] Sender acceptance channel error - subscription failed');
      }
    });

    return () => {
      console.log('[InvitationRealtime] Cleaning up sender acceptance subscription:', channelName);
      safeRemoveChannel(senderChannel);
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
