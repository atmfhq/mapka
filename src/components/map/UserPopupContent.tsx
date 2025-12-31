import { useState } from 'react';
import { X, Zap, MessageCircle, UserX, LogIn, UserPlus, UserCheck, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SendInviteModal from './SendInviteModal';
import AvatarDisplay from '@/components/avatar/AvatarDisplay';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { getShortUserId } from '@/utils/userIdDisplay';
import { useFollows } from '@/hooks/useFollows';

interface AvatarConfig {
  skinColor?: string;
  shape?: string;
  eyes?: string;
  mouth?: string;
}

interface UserPopupContentProps {
  user: {
    id: string;
    nick: string | null;
    avatar_url: string | null;
    avatar_config: AvatarConfig | null;
    tags: string[] | null;
    bio: string | null;
  };
  currentUserId: string | null;
  isConnected: boolean;
  invitationId?: string;
  onClose: () => void;
  onOpenChat?: (userId: string) => void;
  onDisconnect?: () => void;
  onCloseChat?: () => void;
  onNavigate?: (path: string) => void;
  showOnMapEnabled?: boolean;
  onShowOnMap?: () => void;
}

const UserPopupContent = ({ 
  user, 
  currentUserId, 
  isConnected, 
  invitationId, 
  onClose, 
  onOpenChat, 
  onDisconnect, 
  onCloseChat,
  onNavigate,
  showOnMapEnabled,
  onShowOnMap
}: UserPopupContentProps) => {
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const { isFollowing, loading: followLoading, follow, unfollow } = useFollows(currentUserId, user.id);

  const isGuest = !currentUserId;
  const isOwnProfile = currentUserId ? user.id === currentUserId : false;

  const handleDisconnect = async () => {
    if (!invitationId) return;
    
    setDisconnecting(true);
    onCloseChat?.();
    
    const { error } = await supabase
      .from('invitations')
      .update({ status: 'cancelled' })
      .eq('id', invitationId);

    setDisconnecting(false);
    
    if (error) {
      toast({
        title: 'Failed to disconnect',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Connection terminated. You can send a new signal to reconnect.' });
      onDisconnect?.();
      onClose();
    }
  };

  const handleFollowToggle = async () => {
    if (isFollowing) {
      const success = await unfollow(user.id);
      if (success) {
        toast({ title: `Unfollowed ${user.nick || 'user'}` });
      }
    } else {
      const success = await follow(user.id);
      if (success) {
        toast({ title: `Following ${user.nick || 'user'}` });
      }
    }
  };

  return (
    <>
      <div className={`relative bg-card/95 backdrop-blur-md border rounded-lg p-4 min-w-[220px] max-w-[300px] ${
        isConnected 
          ? 'border-success/50 shadow-[0_0_20px_hsl(var(--success)/0.3)]' 
          : 'border-primary/30 shadow-[0_0_20px_hsl(var(--primary)/0.3)]'
      }`}>
        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 w-6 h-6"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </Button>

        {/* Connected badge */}
        {isConnected && (
          <div className="absolute -top-2 left-4 px-2 py-0.5 rounded-full bg-success text-success-foreground text-[10px] font-bold">
            CONNECTED
          </div>
        )}

        {/* Content */}
        <div className="flex items-start gap-3">
          <div className="w-14 h-14 rounded-xl overflow-visible flex items-center justify-center flex-shrink-0 relative z-10">
            <AvatarDisplay 
              config={user.avatar_config} 
              size={56} 
              showGlow={false}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`font-fredoka font-bold truncate ${
              isConnected ? 'text-success' : 'text-primary'
            }`}>
              {user.nick || 'User'}
            </h3>
            <span className="font-mono text-[10px] text-muted-foreground/70">
              {getShortUserId(user.id)}
            </span>
            {user.bio && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {user.bio}
              </p>
            )}
          </div>
        </div>

        {/* Tags */}
        {user.tags && user.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {user.tags.slice(0, 4).map((tag, index) => (
              <span
                key={index}
                className={`px-2 py-0.5 rounded border font-nunito text-[10px] ${
                  isConnected 
                    ? 'bg-success/20 border-success/30 text-success'
                    : 'bg-primary/20 border-primary/30 text-primary'
                }`}
              >
                {tag}
              </span>
            ))}
            {user.tags.length > 4 && (
              <span className="px-2 py-0.5 font-nunito text-[10px] text-muted-foreground">
                +{user.tags.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Action buttons */}
        {!isOwnProfile && (
          isGuest ? (
            <div className="space-y-2 mt-4">
              {showOnMapEnabled && onShowOnMap && (
                <Button
                  onClick={onShowOnMap}
                  variant="outline"
                  className="w-full font-fredoka text-xs border-primary/30 text-primary hover:bg-primary/10"
                  size="sm"
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  Show on Map
                </Button>
              )}
              <Button
                onClick={() => {
                  onClose();
                  onNavigate?.('/auth');
                }}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-fredoka text-xs"
                size="sm"
              >
                <LogIn className="w-4 h-4 mr-2" />
                Login to Connect
              </Button>
            </div>
          ) : (
            <div className="space-y-2 mt-4">
              {/* Show on Map button - only when user is in viewport */}
              {showOnMapEnabled && onShowOnMap && (
                <Button
                  onClick={onShowOnMap}
                  variant="outline"
                  className="w-full font-fredoka text-xs border-primary/30 text-primary hover:bg-primary/10"
                  size="sm"
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  Show on Map
                </Button>
              )}

              {/* Follow/Unfollow button */}
              <Button
                onClick={handleFollowToggle}
                disabled={followLoading}
                variant={isFollowing ? 'outline' : 'secondary'}
                className={`w-full font-fredoka text-xs ${
                  isFollowing 
                    ? 'border-muted-foreground/30' 
                    : 'bg-secondary hover:bg-secondary/90'
                }`}
                size="sm"
              >
                {isFollowing ? (
                  <>
                    <UserCheck className="w-4 h-4 mr-2" />
                    Following
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Follow
                  </>
                )}
              </Button>

              {isConnected ? (
                <>
                  <Button
                    onClick={() => {
                      onOpenChat?.(user.id);
                      onClose();
                    }}
                    className="w-full bg-success hover:bg-success/90 text-success-foreground font-fredoka text-xs"
                    size="sm"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Open Chat
                  </Button>
                  <Button
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    variant="outline"
                    className="w-full border-destructive/50 text-destructive hover:bg-destructive/10 font-fredoka text-xs"
                    size="sm"
                  >
                    <UserX className="w-4 h-4 mr-2" />
                    {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => setInviteModalOpen(true)}
                  className="w-full bg-warning hover:bg-warning/90 text-warning-foreground font-fredoka text-xs"
                  size="sm"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Send Invite
                </Button>
              )}
            </div>
          )
        )}
      </div>

      {currentUserId && (
        <SendInviteModal
          open={inviteModalOpen}
          onOpenChange={setInviteModalOpen}
          targetUser={user}
          currentUserId={currentUserId}
        />
      )}
    </>
  );
};

export default UserPopupContent;
