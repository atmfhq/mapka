import { useState } from 'react';
import { X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SendInviteModal from './SendInviteModal';

interface UserPopupProps {
  user: {
    id: string;
    nick: string | null;
    avatar_url: string | null;
    tags: string[] | null;
    bio: string | null;
  };
  position: { x: number; y: number };
  currentUserId: string;
  onClose: () => void;
}

const UserPopup = ({ user, position, currentUserId, onClose }: UserPopupProps) => {
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  const isOwnProfile = user.id === currentUserId;

  return (
    <>
      <div 
        className="fixed z-50 animate-in fade-in zoom-in-95 duration-200"
        style={{
          left: `${position.x}px`,
          top: `${position.y - 16}px`,
          transform: 'translate(-50%, -100%)',
        }}
      >
        <div className="relative bg-card/95 backdrop-blur-md border border-primary/30 rounded-lg p-4 min-w-[220px] max-w-[300px] shadow-[0_0_20px_hsl(var(--primary)/0.3)]">
          {/* Arrow */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-card/95 border-r border-b border-primary/30 rotate-45" />
          
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 w-6 h-6"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>

          {/* Content */}
          <div className="flex items-start gap-3">
            <img 
              src={user.avatar_url || '/placeholder.svg'} 
              alt={user.nick || 'User'}
              className="w-14 h-14 rounded-lg border-2 border-primary/40 object-cover"
            />
            <div className="flex-1 min-w-0">
              <h3 className="font-orbitron font-bold text-primary truncate">
                {user.nick || 'Unknown Operative'}
              </h3>
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
                  className="px-2 py-0.5 rounded bg-primary/20 border border-primary/30 font-mono text-[10px] text-primary"
                >
                  {tag}
                </span>
              ))}
              {user.tags.length > 4 && (
                <span className="px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                  +{user.tags.length - 4}
                </span>
              )}
            </div>
          )}

          {/* Signal button */}
          {!isOwnProfile && (
            <Button
              onClick={() => setInviteModalOpen(true)}
              className="w-full mt-4 bg-warning hover:bg-warning/90 text-warning-foreground font-orbitron text-xs"
              size="sm"
            >
              <Zap className="w-4 h-4 mr-2" />
              SIGNAL OPERATIVE
            </Button>
          )}
        </div>
      </div>

      <SendInviteModal
        open={inviteModalOpen}
        onOpenChange={setInviteModalOpen}
        targetUser={user}
        currentUserId={currentUserId}
      />
    </>
  );
};

export default UserPopup;
