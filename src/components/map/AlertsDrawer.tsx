import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { Bell, MapPin, Calendar, Users } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { getActivityById } from '@/constants/activities';

interface PublicEvent {
  id: string;
  title: string;
  category: string;
  start_time: string;
  lat: number;
  lng: number;
  host_id: string;
  host?: {
    nick: string | null;
    avatar_url: string | null;
  };
}

interface AlertsDrawerProps {
  currentUserId: string;
  onOpenMission?: (missionId: string) => void;
}

const AlertsDrawer = ({ currentUserId, onOpenMission }: AlertsDrawerProps) => {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<PublicEvent[]>([]);
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

      // Fetch host profiles
      const hostIds = [...new Set(activeEvents.map(e => e.host_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nick, avatar_url')
        .in('id', hostIds);

      const eventsWithHosts = activeEvents.map(event => ({
        ...event,
        host: profiles?.find(p => p.id === event.host_id),
      }));

      setEvents(eventsWithHosts);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchEvents();
      setNewEventCount(0);
    }
  }, [open, fetchEvents]);

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
          <SheetTitle className="font-orbitron text-xl flex items-center gap-2">
            <Bell className="w-5 h-5 text-warning" />
            Area Alerts
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[60vh] mt-4">
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
              events.map((event) => {
                const activityData = getActivityById(event.category);
                const isUpcoming = new Date(event.start_time).getTime() > Date.now();
                
                return (
                  <button
                    key={event.id}
                    onClick={() => {
                      onOpenMission?.(event.id);
                      setOpen(false);
                    }}
                    className="w-full p-4 rounded-lg bg-muted/20 border border-border/50 hover:border-primary/50 transition-colors text-left"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-2xl">
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
                        {event.host && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            Hosted by {event.host.nick || 'Unknown'}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default AlertsDrawer;
