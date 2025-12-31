import { createPortal } from 'react-dom';
import { X, ArrowLeft, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  showBackButton?: boolean;
  onBack?: () => void;
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
  showBackButton,
  onBack,
}: ProfileModalProps) => {
  if (!open || !user) return null;

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

  const handleClose = () => {
    onOpenChange(false);
  };

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ isolation: 'isolate' }}>
      {/* Backdrop - Light blue overlay matching design system */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal - White card with border */}
      <div className="relative bg-card border-2 border-border rounded-2xl shadow-hard w-full max-w-sm max-h-[85vh] flex flex-col animate-in zoom-in-95 fade-in duration-200 z-10">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            {/* Back button */}
            {showBackButton && onBack && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                className="rounded-lg hover:bg-muted -ml-1"
              >
                <ArrowLeft className="w-5 h-5 text-muted-foreground" />
              </Button>
            )}
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isConnected 
                ? 'bg-success/20 border border-success/40' 
                : 'bg-primary/20 border border-primary/40'
            }`}>
              <User className={`w-5 h-5 ${isConnected ? 'text-success' : 'text-primary'}`} />
            </div>
            <div>
              <h3 className="font-nunito font-bold text-foreground">Profile</h3>
              <p className="text-xs text-muted-foreground">
                {isConnected ? 'Connected' : 'View profile'}
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

        {/* Content */}
        <div className="p-4 overflow-auto">
          <UserPopupContent
            user={user}
            currentUserId={currentUserId}
            isConnected={isConnected}
            invitationId={invitationId}
            onClose={handleClose}
            onOpenChat={onOpenChat}
            onDisconnect={onDisconnect}
            onCloseChat={onCloseChat}
            onNavigate={onNavigate}
            showOnMapEnabled={isUserInViewport()}
            onShowOnMap={handleShowOnMap}
          />
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default ProfileModal;
