import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Users, Sparkles, X, Loader2, UserMinus } from 'lucide-react';
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
  onOpenChat?: (userId: string) => void;
}

const ConnectionsDrawer = ({ currentUserId, viewportBounds, unreadCount, onFlyTo, onOpenChat }: ConnectionsDrawerProps) => {
  const { connections, loading, error, refetch } = useConnections(currentUserId);
  const { following, loading: followingLoading, unfollowUser } = useFollowingList(currentUserId);
  const { followers, loading: followersLoading } = useFollowersList(currentUserId);
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ConnectedUser | null>(null);
  const [activeTab, setActiveTab] = useState<string>('connections');
  const [unfollowingId, setUnfollowingId] = useState<string | null>(null);
  const [openedFromConnections, setOpenedFromConnections] = useState(false);

  const handleClose = () => {
    setIsOpen(false);
  };

  // Handle clicking any user - close drawer, open profile modal
  const handleUserClick = (user: ConnectedUser | FollowerUser) => {
    setSelectedUser(user as ConnectedUser);
    setIsOpen(false); // Close drawer first
    setOpenedFromConnections(true); // Mark that we came from connections
    setProfileModalOpen(true);
  };

  // Handle back navigation from profile to connections
  const handleBackToConnections = () => {
    setProfileModalOpen(false);
    setOpenedFromConnections(false);
    setIsOpen(true); // Reopen the drawer on the same tab
  };

  // Handle profile modal close (without going back)
  const handleProfileClose = (open: boolean) => {
    if (!open) {
      setProfileModalOpen(false);
      setOpenedFromConnections(false);
    }
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
          onOpenChange={handleProfileClose}
          user={selectedUser ? {
            id: selectedUser.id,
            nick: selectedUser.nick,
            avatar_url: selectedUser.avatar_url,
            avatar_config: selectedUser.avatar_config,
            tags: selectedUser.tags,
            bio: selectedUser.bio,
            location_lat: selectedUser.location_lat,
            location_lng: selectedUser.location_lng,
          } : null}
          currentUserId={currentUserId}
          isConnected={true}
          invitationId={selectedUser?.invitationId ?? undefined}
          viewportBounds={viewportBounds}
          onFlyTo={onFlyTo}
          onOpenChat={onOpenChat}
          showBackButton={openedFromConnections}
          onBack={handleBackToConnections}
        />
      </>
    );
  }

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center" style={{ isolation: 'isolate' }}>
      {/* Backdrop - hidden on mobile since full-screen */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm hidden md:block"
        onClick={handleClose}
      />

      {/* Modal - Full screen on mobile, card on desktop */}
      <div className="relative bg-card md:border-2 md:border-border md:rounded-2xl md:shadow-hard w-screen h-dvh md:w-full md:max-w-md md:max-h-[85vh] md:h-auto flex flex-col animate-in slide-in-from-bottom-4 md:fade-in duration-300 z-10">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div>
            <h3 className="font-nunito font-bold text-foreground">Network</h3>
            <p className="text-xs text-muted-foreground">
              {connections.length} connection{connections.length !== 1 ? 's' : ''} · {following.length} following · {followers.length} follower{followers.length !== 1 ? 's' : ''}
            </p>
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
              <div className="p-4 space-y-2">
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
                  connections.map(user => (
                    <UserListCard 
                      key={user.id} 
                      user={user}
                      onClick={() => handleUserClick(user)}
                    />
                  ))
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
                      onClick={() => handleUserClick(user as ConnectedUser)}
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
                    <FollowerCard 
                      key={user.id} 
                      user={user} 
                      onClick={() => handleUserClick(user as ConnectedUser)}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>

      {/* Profile Modal - should not appear when drawer is open */}
    </div>
  );

  return (
    <>
      {triggerButton}
      {createPortal(modalContent, document.body)}
    </>
  );
};

// Unified User List Card - consistent styling across all tabs
interface UserListCardProps {
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
  onClick?: () => void;
  actionButton?: React.ReactNode;
}

const UserListCard = ({ user, onClick, actionButton }: UserListCardProps) => {
  // Hard truncate bio to 40 characters
  const truncatedBio = user.bio && user.bio.length > 40 
    ? user.bio.slice(0, 40) + '...' 
    : user.bio;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-background hover:bg-muted/30 transition-colors text-left overflow-hidden"
    >
      <div className="shrink-0">
        <AvatarDisplay config={user.avatar_config} size={40} showGlow={false} />
      </div>
      <div className="flex-1 min-w-0 overflow-hidden">
        <p className="font-nunito text-sm font-medium truncate">
          {user.nick || 'Anonymous'}
        </p>
        {truncatedBio && (
          <p className="font-nunito text-xs text-muted-foreground">
            {truncatedBio}
          </p>
        )}
      </div>
      {actionButton && <div className="shrink-0">{actionButton}</div>}
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
  onClick?: () => void;
  onUnfollow: () => void;
  isUnfollowing: boolean;
}

const FollowingCard = ({ user, onClick, onUnfollow, isUnfollowing }: FollowingCardProps) => {
  return (
    <UserListCard
      user={user}
      onClick={onClick}
      actionButton={
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onUnfollow();
          }}
          disabled={isUnfollowing}
          className="text-xs gap-1.5 text-muted-foreground hover:text-destructive hover:border-destructive flex-shrink-0"
        >
          {isUnfollowing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <UserMinus className="w-3.5 h-3.5" />
          )}
          Unfollow
        </Button>
      }
    />
  );
};

interface FollowerCardProps {
  user: FollowerUser;
  onClick?: () => void;
}

const FollowerCard = ({ user, onClick }: FollowerCardProps) => {
  return <UserListCard user={user} onClick={onClick} />;
};

export default ConnectionsDrawer;
