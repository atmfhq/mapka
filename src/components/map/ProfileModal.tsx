import { Dialog, DialogContent } from '@/components/ui/dialog';
import UserPopupContent from './UserPopupContent';

interface AvatarConfig {
  skinColor?: string;
  shape?: string;
  eyes?: string;
  mouth?: string;
}

interface ViewportBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface ProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    nick: string | null;
    avatar_url: string | null;
    avatar_config: AvatarConfig | null;
    tags: string[] | null;
    bio: string | null;
    location_lat?: number | null;
    location_lng?: number | null;
  } | null;
  currentUserId: string | null;
  isConnected: boolean;
  invitationId?: string;
  viewportBounds?: ViewportBounds | null;
  onOpenChat?: (userId: string) => void;
  onDisconnect?: () => void;
  onCloseChat?: () => void;
  onNavigate?: (path: string) => void;
  onFlyTo?: (lat: number, lng: number) => void;
}

const ProfileModal = ({
  open,
  onOpenChange,
  user,
  currentUserId,
  isConnected,
  invitationId,
  viewportBounds,
  onOpenChat,
  onDisconnect,
  onCloseChat,
  onNavigate,
  onFlyTo,
}: ProfileModalProps) => {
  if (!user) return null;

  // Check if user is within viewport bounds
  const isUserInViewport = () => {
    if (!viewportBounds || user.location_lat == null || user.location_lng == null) {
      return false;
    }
    return (
      user.location_lat >= viewportBounds.south &&
      user.location_lat <= viewportBounds.north &&
      user.location_lng >= viewportBounds.west &&
      user.location_lng <= viewportBounds.east
    );
  };

  const handleShowOnMap = () => {
    if (user.location_lat != null && user.location_lng != null && onFlyTo) {
      onFlyTo(user.location_lat, user.location_lng);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 border-none bg-transparent shadow-none max-w-fit">
        <UserPopupContent
          user={user}
          currentUserId={currentUserId}
          isConnected={isConnected}
          invitationId={invitationId}
          onClose={() => onOpenChange(false)}
          onOpenChat={onOpenChat}
          onDisconnect={onDisconnect}
          onCloseChat={onCloseChat}
          onNavigate={onNavigate}
          showOnMapEnabled={isUserInViewport()}
          onShowOnMap={handleShowOnMap}
        />
      </DialogContent>
    </Dialog>
  );
};

export default ProfileModal;
