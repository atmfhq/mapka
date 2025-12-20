import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Clock, Users, Trash2, UserPlus, X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import LobbyChatMessages from './LobbyChatMessages';

interface Megaphone {
  id: string;
  title: string;
  category: string;
  start_time: string;
  duration_minutes: number;
  max_participants: number | null;
  lat: number;
  lng: number;
  host_id: string;
}

interface Profile {
  id: string;
  nick: string | null;
  avatar_url: string | null;
}

interface Participant {
  id: string;
  user_id: string;
  status: string;
  profile?: Profile;
}

interface MegaphoneLobbyProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  megaphone: Megaphone | null;
  currentUserId: string;
  onDelete: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  Sport: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
  Gaming: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40',
  Food: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  Party: 'bg-pink-500/20 text-pink-400 border-pink-500/40',
  Other: 'bg-slate-500/20 text-slate-400 border-slate-500/40',
};

const MegaphoneLobby = ({ 
  open, 
  onOpenChange, 
  megaphone, 
  currentUserId,
  onDelete 
}: MegaphoneLobbyProps) => {
  const [host, setHost] = useState<Profile | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [activeTab, setActiveTab] = useState('info');

  const isHost = megaphone?.host_id === currentUserId;
  const canAccessChat = isHost || hasJoined;

  // Fetch host profile and participants
  useEffect(() => {
    if (!megaphone) return;
    
    // Reset state when megaphone changes
    setActiveTab('info');

    const fetchData = async () => {
      // Fetch host
      const { data: hostData } = await supabase
        .from('profiles')
        .select('id, nick, avatar_url')
        .eq('id', megaphone.host_id)
        .maybeSingle();
      
      if (hostData) setHost(hostData);

      // Fetch participants
      const { data: participantsData } = await supabase
        .from('event_participants')
        .select('id, user_id, status')
        .eq('event_id', megaphone.id);

      if (participantsData) {
        // Fetch profiles for participants
        const userIds = participantsData.map(p => p.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, nick, avatar_url')
          .in('id', userIds);

        const participantsWithProfiles = participantsData.map(p => ({
          ...p,
          profile: profiles?.find(pr => pr.id === p.user_id),
        }));

        setParticipants(participantsWithProfiles);
        setHasJoined(participantsData.some(p => p.user_id === currentUserId));
      }
    };

    fetchData();
  }, [megaphone, currentUserId]);

  const refreshParticipants = async () => {
    if (!megaphone) return;
    
    const { data } = await supabase
      .from('event_participants')
      .select('id, user_id, status')
      .eq('event_id', megaphone.id);
    
    if (data) {
      const userIds = data.map(p => p.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nick, avatar_url')
        .in('id', userIds);

      const participantsWithProfiles = data.map(p => ({
        ...p,
        profile: profiles?.find(pr => pr.id === p.user_id),
      }));

      setParticipants(participantsWithProfiles);
    }
  };

  const handleJoin = async () => {
    if (!megaphone) return;
    setLoading(true);

    const { error } = await supabase.from('event_participants').insert({
      event_id: megaphone.id,
      user_id: currentUserId,
      status: 'joined',
    });

    setLoading(false);

    if (error) {
      toast({
        title: "Failed to join",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Mission joined!", description: "You're now part of the squad." });
    setHasJoined(true);
    
    // Refresh participants and switch to comms tab
    await refreshParticipants();
    setActiveTab('comms');
  };

  const handleLeave = async () => {
    if (!megaphone) return;
    setLoading(true);

    const { error } = await supabase
      .from('event_participants')
      .delete()
      .eq('event_id', megaphone.id)
      .eq('user_id', currentUserId);

    setLoading(false);

    if (error) {
      toast({
        title: "Failed to leave",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Left mission" });
    setHasJoined(false);
    setParticipants(prev => prev.filter(p => p.user_id !== currentUserId));
  };

  const handleDelete = async () => {
    if (!megaphone) return;
    setLoading(true);

    const { error } = await supabase
      .from('megaphones')
      .delete()
      .eq('id', megaphone.id);

    setLoading(false);

    if (error) {
      toast({
        title: "Failed to delete",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Megaphone deleted" });
    onDelete();
    onOpenChange(false);
  };

  if (!megaphone) return null;

  const startTime = new Date(megaphone.start_time);
  const endTime = new Date(startTime.getTime() + megaphone.duration_minutes * 60000);
  const spotsLeft = (megaphone.max_participants || 10) - participants.length - 1; // -1 for host

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="bg-card border-t border-primary/30 rounded-t-2xl max-h-[85vh] overflow-y-auto"
      >
        <SheetHeader className="space-y-4 pb-4 border-b border-border/50">
          {/* Category Badge */}
          <div className="flex items-center justify-between">
            <Badge 
              variant="outline" 
              className={CATEGORY_COLORS[megaphone.category] || CATEGORY_COLORS.Other}
            >
              {megaphone.category}
            </Badge>
            {isHost && (
              <Badge variant="outline" className="bg-success/20 text-success border-success/40">
                HOST
              </Badge>
            )}
            {hasJoined && !isHost && (
              <Badge variant="outline" className="bg-primary/20 text-primary border-primary/40">
                JOINED
              </Badge>
            )}
          </div>

          {/* Title */}
          <SheetTitle className="font-orbitron text-2xl tracking-wide text-left">
            {megaphone.title}
          </SheetTitle>

          {/* Event details */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-primary" />
              <span>{format(startTime, 'MMM d, h:mm a')}</span>
              <span className="text-muted-foreground/50">→</span>
              <span>{format(endTime, 'h:mm a')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-primary" />
              <span>{participants.length + 1} / {megaphone.max_participants || 10}</span>
              {spotsLeft > 0 && (
                <span className="text-success">({spotsLeft} spots left)</span>
              )}
            </div>
          </div>
        </SheetHeader>

        {/* Tabs: Info / Comms */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-2 bg-muted/30">
            <TabsTrigger value="info" className="font-mono text-xs">
              INTEL
            </TabsTrigger>
            <TabsTrigger 
              value="comms" 
              disabled={!canAccessChat}
              className="font-mono text-xs"
            >
              COMMS {!canAccessChat && '🔒'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="py-4 space-y-6">
            {/* Host */}
            <div className="space-y-3">
              <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Mission Commander
              </h4>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                <Avatar className="w-10 h-10 border-2 border-warning">
                  <AvatarImage src={host?.avatar_url || undefined} />
                  <AvatarFallback className="bg-warning/20 text-warning">
                    {host?.nick?.[0]?.toUpperCase() || 'H'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{host?.nick || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground">Host</p>
                </div>
              </div>
            </div>

            {/* Participants */}
            {participants.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Squad Members ({participants.length})
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {participants.map((p) => (
                    <div 
                      key={p.id}
                      className="flex items-center gap-2 p-2 rounded-lg bg-muted/20 border border-border/30"
                    >
                      <Avatar className="w-8 h-8 border border-primary/50">
                        <AvatarImage src={p.profile?.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/20 text-primary text-xs">
                          {p.profile?.nick?.[0]?.toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm truncate">
                        {p.profile?.nick || 'Anonymous'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3 pt-4 border-t border-border/50">
              {isHost ? (
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1 border-destructive/50 text-destructive hover:bg-destructive/10"
                    onClick={handleDelete}
                    disabled={loading}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>
              ) : hasJoined ? (
                <Button 
                  variant="outline"
                  className="w-full border-destructive/50 text-destructive hover:bg-destructive/10"
                  onClick={handleLeave}
                  disabled={loading}
                >
                  <X className="w-4 h-4 mr-2" />
                  Leave Mission
                </Button>
              ) : spotsLeft > 0 ? (
                <Button 
                  className="w-full bg-success hover:bg-success/90 text-success-foreground font-orbitron"
                  onClick={handleJoin}
                  disabled={loading}
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  JOIN MISSION
                </Button>
              ) : (
                <Button disabled className="w-full">
                  <Users className="w-4 h-4 mr-2" />
                  Mission Full
                </Button>
              )}
            </div>
          </TabsContent>

          <TabsContent value="comms" className="py-4">
            {canAccessChat && megaphone && (
              <LobbyChatMessages 
                eventId={megaphone.id} 
                currentUserId={currentUserId} 
              />
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};

export default MegaphoneLobby;
