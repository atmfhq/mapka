import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { Bell, MapPin, Calendar, Users, Crown } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { getActivityById } from '@/constants/activities';

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

interface PublicEvent {
  id: string;
  title: string;
  category: string;
  start_time: string;
  lat: number;
  lng: number;
  host_id: string;
  host?: PublicProfile;
  participant_count?: number;
}

interface AlertsDrawerProps {
  currentUserId: string;
  onOpenMission?: (missionId: string) => void;
  onFlyToQuest?: (lat: number, lng: number) => void;
}

const AlertsDrawer = ({ currentUserId, onOpenMission, onFlyToQuest }: AlertsDrawerProps) => {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [myQuests, setMyQuests] = useState<PublicEvent[]>([]);
  const [newEventCount, setNewEventCount] = useState(0);

  const fetchEvents = useCallback(async () => {
    const { data, error } = await supabase
      .from('megaphones')
      .select('id, title, category, start_time, lat, lng, host_id, is_private')
      .eq('is_private', false)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      // Filter to only active/future events
      const now = Date.now();
      const activeEvents = data.filter(m => {
        const startTime = new Date(m.start_time).getTime();
        return startTime > now - 2 * 60 * 60 * 1000; // Within last 2h or future
      });

      // Fetch host profiles using secure RPC function
      const hostIds = [...new Set(activeEvents.map(e => e.host_id))];
      const { data: profiles } = await supabase
        .rpc('get_public_profiles_by_ids', { user_ids: hostIds });

      const eventsWithHosts = activeEvents.map(event => ({
        ...event,
        host: profiles?.find(p => p.id === event.host_id),
      }));

      setEvents(eventsWithHosts);
    }
  }, []);

  const fetchMyQuests = useCallback(async () => {
    if (!currentUserId) return;

    const { data, error } = await supabase
      .from('megaphones')
      .select('id, title, category, start_time, lat, lng, host_id, is_private, duration_minutes')
      .eq('host_id', currentUserId)
      .order('start_time', { ascending: false })
      .limit(20);

    if (!error && data) {
      // Filter to only active/future events
      const now = Date.now();
      const activeQuests = data.filter(m => {
        const endTime = new Date(m.start_time).getTime() + (m.duration_minutes * 60 * 1000);
        return endTime > now;
      });

      // Fetch participant counts
      const questIds = activeQuests.map(q => q.id);
      const { data: participants } = await supabase
        .from('event_participants')
        .select('event_id')
        .in('event_id', questIds)
        .eq('status', 'joined');

      const questsWithCounts = activeQuests.map(quest => ({
        ...quest,
        participant_count: participants?.filter(p => p.event_id === quest.id).length || 0,
      }));

      setMyQuests(questsWithCounts);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (open) {
      fetchEvents();
      fetchMyQuests();
      setNewEventCount(0);
    }
  }, [open, fetchEvents, fetchMyQuests]);

  // Subscribe to new public events
  useEffect(() => {
    const channel = supabase
      .channel('public-events')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'megaphones',
        },
        (payload) => {
          // Only count public events
          if (!payload.new.is_private) {
            setNewEventCount(prev => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleQuestClick = (quest: PublicEvent) => {
    onFlyToQuest?.(quest.lat, quest.lng);
    onOpenMission?.(quest.id);
    setOpen(false);
  };

  const renderEventCard = (event: PublicEvent, isMyQuest = false) => {
    const activityData = getActivityById(event.category);
    const isUpcoming = new Date(event.start_time).getTime() > Date.now();
    
    return (
      <button
        key={event.id}
        onClick={() => handleQuestClick(event)}
        className="w-full p-4 rounded-lg bg-muted/20 border border-border/50 hover:border-primary/50 transition-colors text-left"
      >
        <div className="flex items-start gap-3">
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${
            isMyQuest 
              ? 'bg-primary/30 border-2 border-primary' 
              : 'bg-primary/20 border border-primary/40'
          }`}>
            {activityData?.icon || '📍'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold truncate">{event.title}</h4>
              {isUpcoming && (
                <Badge variant="outline" className="bg-success/20 text-success border-success/40 text-xs shrink-0">
                  Upcoming
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {format(new Date(event.start_time), 'MMM d, h:mm a')}
            </p>
            {isMyQuest ? (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Users className="w-3 h-3" />
                {event.participant_count || 0} participant{(event.participant_count || 0) !== 1 ? 's' : ''}
              </p>
            ) : event.host && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Users className="w-3 h-3" />
                Hosted by {event.host.nick || 'Unknown'}
              </p>
            )}
          </div>
        </div>
      </button>
    );
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative min-w-[44px] min-h-[44px] text-muted-foreground hover:text-foreground"
        >
          <Bell className="w-5 h-5" />
          {newEventCount > 0 && (
            <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-warning text-warning-foreground text-xs font-bold flex items-center justify-center animate-pulse">
              {newEventCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh]">
        <SheetHeader>
          <SheetTitle className="font-fredoka text-xl flex items-center gap-2">
            <Bell className="w-5 h-5 text-warning" />
            Quest Hub
          </SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="alerts" className="mt-4">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="alerts" className="gap-2">
              <Bell className="w-4 h-4" />
              Area Alerts
            </TabsTrigger>
            <TabsTrigger value="my-quests" className="gap-2">
              <Crown className="w-4 h-4" />
              My Quests
              {myQuests.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {myQuests.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="alerts">
            <ScrollArea className="h-[55vh]">
              <div className="space-y-3">
                {events.length === 0 ? (
                  <div className="text-center py-12">
                    <MapPin className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground text-sm">No public events nearby</p>
                    <p className="text-muted-foreground/60 text-xs mt-1">
                      Tap the map to deploy a megaphone
                    </p>
                  </div>
                ) : (
                  events.map((event) => renderEventCard(event, false))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="my-quests">
            <ScrollArea className="h-[55vh]">
              <div className="space-y-3">
                {myQuests.length === 0 ? (
                  <div className="text-center py-12">
                    <Crown className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground text-sm">You haven't created any quests</p>
                    <p className="text-muted-foreground/60 text-xs mt-1">
                      Long-press on the map to deploy your first quest
                    </p>
                  </div>
                ) : (
                  myQuests.map((quest) => renderEventCard(quest, true))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};

export default AlertsDrawer;
