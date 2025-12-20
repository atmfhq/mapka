import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { Bell, Check, X, Calendar, Lock, Users } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  nick: string | null;
  avatar_url: string | null;
  base_lat: number | null;
  base_lng: number | null;
}

interface Invitation {
  id: string;
  sender_id: string;
  receiver_id: string;
  activity_type: string;
  status: string;
  created_at: string;
  sender?: Profile;
  receiver?: Profile;
}

interface ActiveMission {
  id: string;
  title: string;
  category: string;
  start_time: string;
  is_private: boolean;
  host_id: string;
}

interface MissionLogProps {
  currentUserId: string;
  onMissionCreated?: () => void;
  onOpenMission?: (missionId: string) => void;
}

const ACTIVITY_LABELS: Record<string, { label: string; emoji: string }> = {
  coffee: { label: 'Coffee', emoji: '☕' },
  walk: { label: 'Walk', emoji: '🚶' },
  gaming: { label: 'Gaming', emoji: '🎮' },
  food: { label: 'Food', emoji: '🍕' },
  workout: { label: 'Workout', emoji: '💪' },
  chat: { label: 'Just Chat', emoji: '💬' },
};

const MissionLog = ({ currentUserId, onMissionCreated, onOpenMission }: MissionLogProps) => {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [activeMissions, setActiveMissions] = useState<ActiveMission[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const pendingCount = invitations.filter(
    (i) => i.status === 'pending' && i.receiver_id === currentUserId
  ).length;

  const fetchData = useCallback(async () => {
    // Fetch invitations
    const { data: invitesData } = await supabase
      .from('invitations')
      .select('*')
      .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
      .order('created_at', { ascending: false });

    if (invitesData) {
      // Fetch profiles for senders and receivers
      const userIds = [
        ...new Set(invitesData.flatMap((i) => [i.sender_id, i.receiver_id])),
      ];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nick, avatar_url, base_lat, base_lng')
        .in('id', userIds);

      const invitesWithProfiles = invitesData.map((inv) => ({
        ...inv,
        sender: profiles?.find((p) => p.id === inv.sender_id),
        receiver: profiles?.find((p) => p.id === inv.receiver_id),
      }));

      setInvitations(invitesWithProfiles);
    }

    // Fetch active missions (events user is participating in)
    const { data: participations } = await supabase
      .from('event_participants')
      .select('event_id')
      .eq('user_id', currentUserId)
      .eq('status', 'joined');

    const eventIds = participations?.map((p) => p.event_id) || [];

    // Also include events where user is host
    const { data: missions } = await supabase
      .from('megaphones')
      .select('id, title, category, start_time, is_private, host_id')
      .or(`host_id.eq.${currentUserId}${eventIds.length > 0 ? `,id.in.(${eventIds.join(',')})` : ''}`);

    if (missions) {
      // Filter to only active/future events
      const now = Date.now();
      const activeMissions = missions.filter((m) => {
        const startTime = new Date(m.start_time).getTime();
        return startTime > now - 24 * 60 * 60 * 1000; // Within last 24h or future
      });
      setActiveMissions(activeMissions);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, fetchData]);

  // Subscribe to realtime invitation updates
  useEffect(() => {
    const channel = supabase
      .channel('invitations-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'invitations',
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const handleAccept = async (invitation: Invitation) => {
    setLoading(true);

    try {
      // 1. Update invitation status
      const { error: updateError } = await supabase
        .from('invitations')
        .update({ status: 'accepted' })
        .eq('id', invitation.id);

      if (updateError) throw updateError;

      // 2. Get location data for both users
      const senderLat = invitation.sender?.base_lat || 40.7128;
      const senderLng = invitation.sender?.base_lng || -74.006;
      const receiverLat = invitation.receiver?.base_lat || 40.7128;
      const receiverLng = invitation.receiver?.base_lng || -74.006;

      // Calculate midpoint for the private event
      const midLat = (senderLat + receiverLat) / 2;
      const midLng = (senderLng + receiverLng) / 2;

      const activityInfo = ACTIVITY_LABELS[invitation.activity_type] || {
        label: invitation.activity_type,
        emoji: '📍',
      };

      // 3. Create private megaphone - current user (receiver) becomes host
      const { data: megaphone, error: megaphoneError } = await supabase
        .from('megaphones')
        .insert({
          title: `${activityInfo.emoji} ${activityInfo.label} Meetup`,
          category: 'Other',
          start_time: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 mins from now
          duration_minutes: 120,
          max_participants: 2,
          lat: midLat,
          lng: midLng,
          host_id: currentUserId, // Current user (accepter) becomes host
          is_private: true,
        })
        .select()
        .single();

      if (megaphoneError) throw megaphoneError;

      // 4. Add the invitation sender to participants (receiver is already host)
      const { error: participantError } = await supabase
        .from('event_participants')
        .insert([
          { event_id: megaphone.id, user_id: invitation.sender_id, status: 'joined' },
        ]);

      if (participantError) throw participantError;

      toast({
        title: "Invitation Accepted!",
        description: "Private mission created. Check your Active Missions.",
      });

      // Refresh data
      fetchData();
      onMissionCreated?.();

      // Open the new mission
      if (onOpenMission) {
        onOpenMission(megaphone.id);
        setOpen(false);
      }
    } catch (error: any) {
      toast({
        title: "Failed to accept",
        description: error.message,
        variant: "destructive",
      });
    }

    setLoading(false);
  };

  const handleReject = async (invitationId: string) => {
    setLoading(true);

    const { error } = await supabase
      .from('invitations')
      .update({ status: 'rejected' })
      .eq('id', invitationId);

    setLoading(false);

    if (error) {
      toast({
        title: "Failed to reject",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Invitation rejected" });
    fetchData();
  };

  const incomingInvites = invitations.filter(
    (i) => i.receiver_id === currentUserId && i.status === 'pending'
  );

  const sentInvites = invitations.filter(
    (i) => i.sender_id === currentUserId && i.status === 'pending'
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground"
        >
          <Bell className="w-5 h-5" />
          {pendingCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-warning text-warning-foreground text-xs font-bold flex items-center justify-center animate-pulse">
              {pendingCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md bg-card border-l border-primary/30">
        <SheetHeader>
          <SheetTitle className="font-orbitron text-xl flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            Mission Log
          </SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="alerts" className="mt-4">
          <TabsList className="grid w-full grid-cols-2 bg-muted/30">
            <TabsTrigger value="alerts" className="font-mono text-xs">
              ALERTS {pendingCount > 0 && `(${pendingCount})`}
            </TabsTrigger>
            <TabsTrigger value="active" className="font-mono text-xs">
              ACTIVE ({activeMissions.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="alerts" className="mt-4">
            <ScrollArea className="h-[60vh]">
              <div className="space-y-3">
                {incomingInvites.length === 0 && sentInvites.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-8">
                    No pending signals
                  </p>
                ) : (
                  <>
                    {/* Incoming */}
                    {incomingInvites.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                          Incoming Signals
                        </h4>
                        {incomingInvites.map((inv) => {
                          const activity = ACTIVITY_LABELS[inv.activity_type] || {
                            label: inv.activity_type,
                            emoji: '📍',
                          };
                          return (
                            <div
                              key={inv.id}
                              className="p-3 rounded-lg bg-warning/10 border border-warning/30"
                            >
                              <div className="flex items-center gap-3">
                                <Avatar className="w-10 h-10 border-2 border-warning">
                                  <AvatarImage src={inv.sender?.avatar_url || undefined} />
                                  <AvatarFallback className="bg-warning/20 text-warning">
                                    {inv.sender?.nick?.[0]?.toUpperCase() || '?'}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                  <p className="font-semibold text-sm">
                                    {inv.sender?.nick || 'Unknown'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {activity.emoji} {activity.label} •{' '}
                                    {format(new Date(inv.created_at), 'h:mm a')}
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-2 mt-3">
                                <Button
                                  size="sm"
                                  className="flex-1 bg-success hover:bg-success/90"
                                  onClick={() => handleAccept(inv)}
                                  disabled={loading}
                                >
                                  <Check className="w-4 h-4 mr-1" />
                                  Accept
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1 border-destructive/50 text-destructive hover:bg-destructive/10"
                                  onClick={() => handleReject(inv.id)}
                                  disabled={loading}
                                >
                                  <X className="w-4 h-4 mr-1" />
                                  Reject
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Sent */}
                    {sentInvites.length > 0 && (
                      <div className="space-y-2 mt-4">
                        <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                          Sent Signals (Pending)
                        </h4>
                        {sentInvites.map((inv) => {
                          const activity = ACTIVITY_LABELS[inv.activity_type] || {
                            label: inv.activity_type,
                            emoji: '📍',
                          };
                          return (
                            <div
                              key={inv.id}
                              className="p-3 rounded-lg bg-muted/20 border border-border/50"
                            >
                              <div className="flex items-center gap-3">
                                <Avatar className="w-10 h-10 border border-primary/50">
                                  <AvatarImage src={inv.receiver?.avatar_url || undefined} />
                                  <AvatarFallback className="bg-primary/20 text-primary">
                                    {inv.receiver?.nick?.[0]?.toUpperCase() || '?'}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                  <p className="font-semibold text-sm">
                                    {inv.receiver?.nick || 'Unknown'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {activity.emoji} {activity.label} • Awaiting response
                                  </p>
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  Pending
                                </Badge>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="active" className="mt-4">
            <ScrollArea className="h-[60vh]">
              <div className="space-y-2">
                {activeMissions.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-8">
                    No active missions
                  </p>
                ) : (
                  activeMissions.map((mission) => (
                    <button
                      key={mission.id}
                      onClick={() => {
                        onOpenMission?.(mission.id);
                        setOpen(false);
                      }}
                      className="w-full p-3 rounded-lg bg-muted/20 border border-border/50 hover:border-primary/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            mission.is_private
                              ? 'bg-warning/20 border border-warning/40'
                              : 'bg-primary/20 border border-primary/40'
                          }`}
                        >
                          {mission.is_private ? (
                            <Lock className="w-5 h-5 text-warning" />
                          ) : (
                            <Users className="w-5 h-5 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{mission.title}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(mission.start_time), 'MMM d, h:mm a')}
                          </p>
                        </div>
                        {mission.is_private && (
                          <Badge variant="outline" className="bg-warning/20 text-warning border-warning/40 text-xs">
                            Private
                          </Badge>
                        )}
                        {mission.host_id === currentUserId && (
                          <Badge variant="outline" className="bg-success/20 text-success border-success/40 text-xs">
                            Host
                          </Badge>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};

export default MissionLog;
