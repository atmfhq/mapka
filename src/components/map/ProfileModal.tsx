import { Dialog, DialogContent } from '@/components/ui/dialog';
import UserPopupContent from './UserPopupContent';

interface AvatarConfig {
  skinColor?: string;
  shape?: string;
  eyes?: string;
  mouth?: string;
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
  } | null;
  currentUserId: string | null;
  isConnected: boolean;
  invitationId?: string;
  onOpenChat?: (userId: string) => void;
  onDisconnect?: () => void;
  onCloseChat?: () => void;
  onNavigate?: (path: string) => void;
}

const ProfileModal = ({
  open,
  onOpenChange,
  user,
  currentUserId,
  isConnected,
  invitationId,
  onOpenChat,
  onDisconnect,
  onCloseChat,
  onNavigate,
}: ProfileModalProps) => {
  if (!user) return null;

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
        />
      </DialogContent>
    </Dialog>
  );
};

export default ProfileModal;
