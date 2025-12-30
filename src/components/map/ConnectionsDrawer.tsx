import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Sparkles, MapPin, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useConnections, ConnectedUser } from '@/hooks/useConnections';
import AvatarDisplay from '@/components/avatar/AvatarDisplay';

interface ViewportBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface ConnectionsDrawerProps {
  currentUserId: string;
  viewportBounds: ViewportBounds | null;
  unreadCount?: number;
}

const ConnectionsDrawer = ({ currentUserId, viewportBounds, unreadCount }: ConnectionsDrawerProps) => {
  const { connections, loading, error } = useConnections(currentUserId);
  const navigate = useNavigate();

  // Split connections into nearby and others based on viewport
  const { nearby, others } = useMemo(() => {
    if (!viewportBounds || connections.length === 0) {
      return { nearby: [], others: connections };
    }

    const nearbyUsers: ConnectedUser[] = [];
    const otherUsers: ConnectedUser[] = [];

    connections.forEach(user => {
      if (user.location_lat !== null && user.location_lng !== null) {
        const isInViewport = 
          user.location_lat >= viewportBounds.south &&
          user.location_lat <= viewportBounds.north &&
          user.location_lng >= viewportBounds.west &&
          user.location_lng <= viewportBounds.east;

        if (isInViewport) {
          nearbyUsers.push(user);
        } else {
          otherUsers.push(user);
        }
      } else {
        // Users without location go to others
        otherUsers.push(user);
      }
    });

    return { nearby: nearbyUsers, others: otherUsers };
  }, [connections, viewportBounds]);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-10 w-10">
          <Users className="w-5 h-5" />
          {unreadCount && unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md p-0">
        <SheetHeader className="p-4 pb-2 border-b border-border">
          <SheetTitle className="font-fredoka text-xl flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Connections
            <span className="text-sm font-nunito font-normal text-muted-foreground">
              ({connections.length})
            </span>
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-80px)]">
          <div className="p-4 space-y-6">
            {loading ? (
              <LoadingState />
            ) : error ? (
              <ErrorState error={error} />
            ) : connections.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                {/* Nearby Section */}
                {nearby.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <MapPin className="w-4 h-4 text-primary" />
                      <h2 className="font-fredoka text-sm font-semibold text-foreground">
                        Nearby
                      </h2>
                      <span className="text-xs font-nunito text-muted-foreground">
                        ({nearby.length})
                      </span>
                    </div>
                    <div className="space-y-2">
                      {nearby.map(user => (
                        <ConnectionCard key={user.id} user={user} isNearby />
                      ))}
                    </div>
                  </section>
                )}

                {/* Others Section */}
                {others.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <Globe className="w-4 h-4 text-muted-foreground" />
                      <h2 className="font-fredoka text-sm font-semibold text-foreground">
                        {nearby.length > 0 ? 'Others' : 'All Connections'}
                      </h2>
                      <span className="text-xs font-nunito text-muted-foreground">
                        ({others.length})
                      </span>
                    </div>
                    <div className="space-y-2">
                      {others.map(user => (
                        <ConnectionCard key={user.id} user={user} />
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

interface ConnectionCardProps {
  user: ConnectedUser;
  isNearby?: boolean;
}

const ConnectionCard = ({ user, isNearby }: ConnectionCardProps) => {
  return (
    <div 
      className={`
        flex items-center gap-3 p-3 rounded-xl border-2 transition-colors
        ${isNearby 
          ? 'bg-primary/5 border-primary/30 shadow-sm' 
          : 'bg-card border-border hover:border-muted-foreground/30'
        }
      `}
    >
      <div className={`relative ${isNearby ? 'ring-2 ring-primary ring-offset-2 ring-offset-background rounded-full' : ''}`}>
        <AvatarDisplay config={user.avatar_config} size={40} showGlow={false} />
        {isNearby && (
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-fredoka text-sm font-medium truncate">
          {user.nick || 'Anonymous'}
        </p>
        {isNearby && (
          <p className="font-nunito text-xs text-primary">In your area</p>
        )}
      </div>
    </div>
  );
};

const LoadingState = () => (
  <div className="space-y-3">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="flex items-center gap-3 p-3 bg-card rounded-xl border-2 border-border">
        <Skeleton className="w-10 h-10 rounded-full" />
        <Skeleton className="h-4 w-28" />
      </div>
    ))}
  </div>
);

const ErrorState = ({ error }: { error: string }) => (
  <div className="text-center py-8">
    <p className="text-destructive font-nunito text-sm">{error}</p>
    <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="mt-3">
      Try Again
    </Button>
  </div>
);

const EmptyState = () => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Sparkles className="w-8 h-8 text-primary" />
      </div>
      <h2 className="font-fredoka text-lg font-semibold mb-1">No Connections Yet</h2>
      <p className="font-nunito text-sm text-muted-foreground max-w-xs">
        Join spots on the map to automatically connect with their creators!
      </p>
    </div>
  );
};

export default ConnectionsDrawer;
