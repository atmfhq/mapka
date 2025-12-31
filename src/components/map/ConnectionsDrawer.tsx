import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Users, Sparkles, MapPin, Globe, X, Loader2, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useConnections, ConnectedUser } from '@/hooks/useConnections';
import { useFollowingList, useFollowersList, FollowerUser } from '@/hooks/useFollows';
import { useToast } from '@/hooks/use-toast';
import AvatarDisplay from '@/components/avatar/AvatarDisplay';
import ProfileModal from './ProfileModal';

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
  onFlyTo?: (lat: number, lng: number) => void;
}

const ConnectionsDrawer = ({ currentUserId, viewportBounds, unreadCount, onFlyTo }: ConnectionsDrawerProps) => {
  const { connections, loading, error, refetch } = useConnections(currentUserId);
  const { following, loading: followingLoading, unfollowUser } = useFollowingList(currentUserId);
  const { followers, loading: followersLoading } = useFollowersList(currentUserId);
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ConnectedUser | null>(null);
  const [activeTab, setActiveTab] = useState('connections');
  const [unfollowingId, setUnfollowingId] = useState<string | null>(null);

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

  const handleClose = () => {
    setIsOpen(false);
  };

  // Handle clicking a nearby user - fly to them and show profile
  const handleNearbyClick = (user: ConnectedUser) => {
    if (user.location_lat !== null && user.location_lng !== null && onFlyTo) {
      onFlyTo(user.location_lat, user.location_lng);
    }
    setSelectedUser(user);
    setProfileModalOpen(true);
    setIsOpen(false); // Close modal to show map
  };

  // Handle clicking an "others" user - just show profile
  const handleOthersClick = (user: ConnectedUser) => {
    setSelectedUser(user);
    setProfileModalOpen(true);
  };

  const handleUnfollow = async (userId: string, userName: string | null) => {
    setUnfollowingId(userId);
    const success = await unfollowUser(userId);
    setUnfollowingId(null);

    if (success) {
      toast({
        title: 'Unfollowed',
        description: `You have unfollowed ${userName || 'this user'}`,
      });
    } else {
      toast({
        title: 'Error',
        description: 'Failed to unfollow. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Trigger button
  const triggerButton = (
    <Button 
      variant="ghost" 
      size="icon" 
      className="relative min-w-[44px] min-h-[44px] text-muted-foreground hover:text-foreground"
      onClick={() => setIsOpen(true)}
    >
      <Users className="w-5 h-5" />
      {unreadCount && unreadCount > 0 && (
        <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Button>
  );

  if (!isOpen) {
    return (
      <>
        {triggerButton}
        {/* Profile Modal - keep it available even when drawer is closed */}
        <ProfileModal
          open={profileModalOpen}
          onOpenChange={setProfileModalOpen}
          user={selectedUser ? {
            id: selectedUser.id,
            nick: selectedUser.nick,
            avatar_url: selectedUser.avatar_url,
            avatar_config: selectedUser.avatar_config,
            tags: selectedUser.tags,
            bio: selectedUser.bio,
          } : null}
          currentUserId={currentUserId}
          isConnected={true}
          invitationId={selectedUser?.invitationId ?? undefined}
        />
      </>
    );
  }

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center" style={{ isolation: 'isolate' }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-card border-2 border-border rounded-t-2xl sm:rounded-2xl shadow-hard w-full sm:max-w-md max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-4 fade-in duration-300 z-10">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-nunito font-bold text-foreground">Network</h3>
              <p className="text-xs text-muted-foreground">
                {connections.length} connection{connections.length !== 1 ? 's' : ''} · {following.length} following · {followers.length} follower{followers.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
            className="rounded-lg hover:bg-muted"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full grid grid-cols-3 mx-4 mt-3 mb-0" style={{ width: 'calc(100% - 2rem)' }}>
            <TabsTrigger value="connections" className="font-nunito text-sm">
              Connections
            </TabsTrigger>
            <TabsTrigger value="following" className="font-nunito text-sm">
              Following
            </TabsTrigger>
            <TabsTrigger value="followers" className="font-nunito text-sm">
              Followers
            </TabsTrigger>
          </TabsList>

          {/* Connections Tab */}
          <TabsContent value="connections" className="flex-1 overflow-hidden mt-0">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-6">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : error ? (
                  <div className="text-center py-8">
                    <p className="text-destructive font-nunito text-sm">{error}</p>
                    <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3">
                      Try Again
                    </Button>
                  </div>
                ) : connections.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                      <Sparkles className="w-8 h-8 text-primary" />
                    </div>
                    <h2 className="font-nunito text-lg font-bold mb-1">No Connections Yet</h2>
                    <p className="font-nunito text-sm text-muted-foreground max-w-xs">
                      Join spots on the map to automatically connect with their creators!
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Nearby Section */}
                    {nearby.length > 0 && (
                      <section>
                        <div className="flex items-center gap-2 mb-3">
                          <MapPin className="w-4 h-4 text-primary" />
                          <h2 className="font-nunito text-sm font-semibold text-foreground">
                            Nearby
                          </h2>
                          <span className="text-xs font-nunito text-muted-foreground">
                            ({nearby.length})
                          </span>
                        </div>
                        <div className="space-y-2">
                          {nearby.map(user => (
                            <ConnectionCard 
                              key={user.id} 
                              user={user} 
                              isNearby 
                              onClick={() => handleNearbyClick(user)}
                            />
                          ))}
                        </div>
                      </section>
                    )}

                    {/* Others Section */}
                    {others.length > 0 && (
                      <section>
                        <div className="flex items-center gap-2 mb-3">
                          <Globe className="w-4 h-4 text-muted-foreground" />
                          <h2 className="font-nunito text-sm font-semibold text-foreground">
                            {nearby.length > 0 ? 'Others' : 'All Connections'}
                          </h2>
                          <span className="text-xs font-nunito text-muted-foreground">
                            ({others.length})
                          </span>
                        </div>
                        <div className="space-y-2">
                          {others.map(user => (
                            <ConnectionCard 
                              key={user.id} 
                              user={user} 
                              onClick={() => handleOthersClick(user)}
                            />
                          ))}
                        </div>
                      </section>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Following Tab */}
          <TabsContent value="following" className="flex-1 overflow-hidden mt-0">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-2">
                {followingLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : following.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                      <Users className="w-8 h-8 text-primary" />
                    </div>
                    <h2 className="font-nunito text-lg font-bold mb-1">Not Following Anyone</h2>
                    <p className="font-nunito text-sm text-muted-foreground max-w-xs">
                      Follow users to get updates when they create spots or post shouts!
                    </p>
                  </div>
                ) : (
                  following.map(user => (
                    <FollowingCard
                      key={user.id}
                      user={user}
                      onUnfollow={() => handleUnfollow(user.id, user.nick)}
                      isUnfollowing={unfollowingId === user.id}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Followers Tab */}
          <TabsContent value="followers" className="flex-1 overflow-hidden mt-0">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-2">
                {followersLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : followers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                      <Users className="w-8 h-8 text-primary" />
                    </div>
                    <h2 className="font-nunito text-lg font-bold mb-1">No Followers Yet</h2>
                    <p className="font-nunito text-sm text-muted-foreground max-w-xs">
                      When users follow you, they'll appear here!
                    </p>
                  </div>
                ) : (
                  followers.map(user => (
                    <FollowerCard key={user.id} user={user} />
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>

      {/* Profile Modal */}
      <ProfileModal
        open={profileModalOpen}
        onOpenChange={setProfileModalOpen}
        user={selectedUser ? {
          id: selectedUser.id,
          nick: selectedUser.nick,
          avatar_url: selectedUser.avatar_url,
          avatar_config: selectedUser.avatar_config,
          tags: selectedUser.tags,
          bio: selectedUser.bio,
        } : null}
        currentUserId={currentUserId}
        isConnected={true}
        invitationId={selectedUser?.invitationId ?? undefined}
      />
    </div>
  );

  return (
    <>
      {triggerButton}
      {createPortal(modalContent, document.body)}
    </>
  );
};

interface ConnectionCardProps {
  user: ConnectedUser;
  isNearby?: boolean;
  onClick?: () => void;
}

const ConnectionCard = ({ user, isNearby, onClick }: ConnectionCardProps) => {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left
        ${isNearby 
          ? 'bg-primary/5 border-primary/30 shadow-sm hover:border-primary/50 hover:bg-primary/10' 
          : 'bg-card border-border hover:border-muted-foreground/30 hover:bg-muted/30'
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
        <p className="font-nunito text-sm font-medium truncate">
          {user.nick || 'Anonymous'}
        </p>
        {isNearby && (
          <p className="font-nunito text-xs text-primary">Tap to locate on map</p>
        )}
      </div>
      {isNearby && (
        <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
      )}
    </button>
  );
};

interface FollowingCardProps {
  user: {
    id: string;
    nick: string | null;
    avatar_url: string | null;
    avatar_config: {
      skinColor?: string;
      shape?: string;
      eyes?: string;
      mouth?: string;
    } | null;
    bio: string | null;
  };
  onUnfollow: () => void;
  isUnfollowing: boolean;
}

const FollowingCard = ({ user, onUnfollow, isUnfollowing }: FollowingCardProps) => {
  return (
    <div className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-border bg-card">
      <AvatarDisplay config={user.avatar_config} size={40} showGlow={false} />
      <div className="flex-1 min-w-0">
        <p className="font-nunito text-sm font-medium truncate">
          {user.nick || 'Anonymous'}
        </p>
        {user.bio && (
          <p className="font-nunito text-xs text-muted-foreground truncate">{user.bio}</p>
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          onUnfollow();
        }}
        disabled={isUnfollowing}
        className="text-xs gap-1.5 text-muted-foreground hover:text-destructive hover:border-destructive"
      >
        {isUnfollowing ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <UserMinus className="w-3.5 h-3.5" />
        )}
        Unfollow
      </Button>
    </div>
  );
};

interface FollowerCardProps {
  user: FollowerUser;
}

const FollowerCard = ({ user }: FollowerCardProps) => {
  return (
    <div className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-border bg-card">
      <AvatarDisplay config={user.avatar_config} size={40} showGlow={false} />
      <div className="flex-1 min-w-0">
        <p className="font-nunito text-sm font-medium truncate">
          {user.nick || 'Anonymous'}
        </p>
        {user.bio && (
          <p className="font-nunito text-xs text-muted-foreground truncate">{user.bio}</p>
        )}
      </div>
    </div>
  );
};

export default ConnectionsDrawer;
