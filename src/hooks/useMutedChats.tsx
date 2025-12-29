import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MutedChat {
  id: string;
  event_id: string | null;
  invitation_id: string | null;
}

export const useMutedChats = (currentUserId: string | null) => {
  const [mutedEventIds, setMutedEventIds] = useState<Set<string>>(new Set());
  const [mutedInvitationIds, setMutedInvitationIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchMutedChats = useCallback(async () => {
    if (!currentUserId) {
      setMutedEventIds(new Set());
      setMutedInvitationIds(new Set());
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('muted_chats')
      .select('id, event_id, invitation_id')
      .eq('user_id', currentUserId);

    if (error) {
      console.error('Error fetching muted chats:', error);
      setLoading(false);
      return;
    }

    const eventIds = new Set<string>();
    const invIds = new Set<string>();

    for (const item of data || []) {
      if (item.event_id) eventIds.add(item.event_id);
      if (item.invitation_id) invIds.add(item.invitation_id);
    }

    setMutedEventIds(eventIds);
    setMutedInvitationIds(invIds);
    setLoading(false);
  }, [currentUserId]);

  useEffect(() => {
    fetchMutedChats();
  }, [fetchMutedChats]);

  const muteEvent = useCallback(async (eventId: string) => {
    if (!currentUserId) return false;

    const { error } = await supabase
      .from('muted_chats')
      .insert({ user_id: currentUserId, event_id: eventId });

    if (error) {
      console.error('Error muting event:', error);
      return false;
    }

    setMutedEventIds(prev => new Set([...prev, eventId]));
    return true;
  }, [currentUserId]);

  const unmuteEvent = useCallback(async (eventId: string) => {
    if (!currentUserId) return false;

    const { error } = await supabase
      .from('muted_chats')
      .delete()
      .eq('user_id', currentUserId)
      .eq('event_id', eventId);

    if (error) {
      console.error('Error unmuting event:', error);
      return false;
    }

    setMutedEventIds(prev => {
      const next = new Set(prev);
      next.delete(eventId);
      return next;
    });
    return true;
  }, [currentUserId]);

  const muteDm = useCallback(async (invitationId: string) => {
    if (!currentUserId) return false;

    const { error } = await supabase
      .from('muted_chats')
      .insert({ user_id: currentUserId, invitation_id: invitationId });

    if (error) {
      console.error('Error muting DM:', error);
      return false;
    }

    setMutedInvitationIds(prev => new Set([...prev, invitationId]));
    return true;
  }, [currentUserId]);

  const unmuteDm = useCallback(async (invitationId: string) => {
    if (!currentUserId) return false;

    const { error } = await supabase
      .from('muted_chats')
      .delete()
      .eq('user_id', currentUserId)
      .eq('invitation_id', invitationId);

    if (error) {
      console.error('Error unmuting DM:', error);
      return false;
    }

    setMutedInvitationIds(prev => {
      const next = new Set(prev);
      next.delete(invitationId);
      return next;
    });
    return true;
  }, [currentUserId]);

  const isEventMuted = useCallback((eventId: string) => {
    return mutedEventIds.has(eventId);
  }, [mutedEventIds]);

  const isDmMuted = useCallback((invitationId: string) => {
    return mutedInvitationIds.has(invitationId);
  }, [mutedInvitationIds]);

  return {
    mutedEventIds,
    mutedInvitationIds,
    isEventMuted,
    isDmMuted,
    muteEvent,
    unmuteEvent,
    muteDm,
    unmuteDm,
    loading,
    refetch: fetchMutedChats,
  };
};
