import { useState } from 'react';
import { Zap, MessageCircle, UserX, LogIn, UserPlus, UserCheck, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SendInviteModal from './SendInviteModal';
import AvatarDisplay from '@/components/avatar/AvatarDisplay';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { getShortUserId } from '@/utils/userIdDisplay';
import { useFollows } from '@/hooks/useFollows';
import ReportModal from './ReportModal';

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
  onDisconnect?: (userId?: string) => void;
  onCloseChat?: () => void;
  onNavigate?: (path: string) => void;
  onOpenAuthModal?: () => void;
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
  onOpenAuthModal,
  showOnMapEnabled,
  onShowOnMap
}: UserPopupContentProps) => {
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  const { isFollowing, loading: followLoading, follow, unfollow } = useFollows(currentUserId, user.id);

  const isGuest = !currentUserId;
  const isOwnProfile = currentUserId ? user.id === currentUserId : false;

  const handleDisconnect = async () => {
    if (!currentUserId || !isConnected) return;
    
    setDisconnecting(true);
    onCloseChat?.();
    
    let error = null;

    // Handle two types of connections:
    // 1. Invitation-based connections (DM connections) - update status to 'cancelled'
    // 2. Event-based connections (from connections table) - delete the connection row
    if (invitationId) {
      // Invitation-based connection: update status to cancelled
      const { error: invError } = await supabase
        .from('invitations')
        .update({ status: 'cancelled' })
        .eq('id', invitationId);
      
      error = invError;
    } else {
      // Connection from connections table: delete the connection
      // Note: connections table stores user_a_id < user_b_id, so we need to order them
      const userIds = [currentUserId, user.id].sort();
      const userA = userIds[0];
      const userB = userIds[1];
      
      const { error: connError } = await supabase
        .from('connections')
        .delete()
        .eq('user_a_id', userA)
        .eq('user_b_id', userB);
      
      error = connError;
    }

    setDisconnecting(false);
    
    if (error) {
      toast({
        title: 'Failed to disconnect',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Connection terminated. You can send a new signal to reconnect.' });
      onDisconnect?.(user.id);
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
      {/* User Info Section */}
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <AvatarDisplay 
            config={user.avatar_config} 
            size={64} 
            showGlow={false}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className={`font-nunito font-bold text-lg truncate ${
              isConnected ? 'text-success' : 'text-foreground'
            }`}>
              {user.nick || 'Anonymous'}
            </h3>
            {isConnected && (
              <span className="px-2 py-0.5 rounded-full bg-success/20 text-success text-[10px] font-bold uppercase flex-shrink-0">
                Connected
              </span>
            )}
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            {getShortUserId(user.id)}
          </span>
          {user.bio && (
            <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
              {user.bio}
            </p>
          )}
        </div>
      </div>


      {/* Action buttons */}
      {!isOwnProfile && (
        <div className="space-y-2 mt-6">
          {isGuest ? (
            <>
              {showOnMapEnabled && onShowOnMap && (
                <Button
                  onClick={onShowOnMap}
                  variant="outline"
                  className="w-full font-nunito"
                  size="default"
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  Show on Map
                </Button>
              )}
              <Button
                onClick={() => {
                  onClose();
                  onOpenAuthModal?.();
                }}
                className="w-full font-nunito"
                size="default"
              >
                <LogIn className="w-4 h-4 mr-2" />
                Login to Connect
              </Button>
            </>
          ) : (
            <>
              {/* Show on Map button - only when user is in viewport */}
              {showOnMapEnabled && onShowOnMap && (
                <Button
                  onClick={onShowOnMap}
                  variant="outline"
                  className="w-full font-nunito"
                  size="default"
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
                className="w-full font-nunito"
                size="default"
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
                    className="w-full font-nunito"
                    size="default"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Open Chat
                  </Button>
                  <Button
                    onClick={handleDisconnect}
                    disabled={disconnecting || !currentUserId}
                    variant="destructive"
                    className="w-full font-nunito"
                    size="default"
                  >
                    <UserX className="w-4 h-4 mr-2" />
                    {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                  </Button>
                </>
              ) : (
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setInviteModalOpen(true);
                  }}
                  className="w-full font-nunito"
                  size="default"
                  type="button"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Send Invite
                </Button>
              )}

              {/* Report user (subtle text link, bottom-most) */}
              <div className="pt-2 border-t border-border/30 text-center">
                <Button
                  onClick={() => setReportModalOpen(true)}
                  variant="link"
                  size="sm"
                  className="h-auto px-0 py-0 text-xs text-muted-foreground hover:text-destructive no-underline hover:underline"
                >
                  Report user
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {currentUserId && (
        <SendInviteModal
          open={inviteModalOpen}
          onOpenChange={setInviteModalOpen}
          targetUser={user}
          currentUserId={currentUserId}
        />
      )}

      <ReportModal
        open={reportModalOpen}
        onOpenChange={setReportModalOpen}
        currentUserId={currentUserId}
        target={{ type: 'user', id: user.id, label: user.nick || getShortUserId(user.id) }}
        onOpenAuthModal={onOpenAuthModal}
      />
    </>
  );
};

export default UserPopupContent;
