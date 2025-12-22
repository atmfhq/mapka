import { useState } from 'react';
import { X, Zap, MessageCircle, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SendInviteModal from './SendInviteModal';
import AvatarDisplay from '@/components/avatar/AvatarDisplay';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

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
  currentUserId: string;
  isConnected: boolean;
  invitationId?: string;
  onClose: () => void;
  onOpenChat?: (userId: string) => void;
  onDisconnect?: () => void;
  onCloseChat?: () => void;
}

const UserPopupContent = ({ 
  user, 
  currentUserId, 
  isConnected, 
  invitationId, 
  onClose, 
  onOpenChat, 
  onDisconnect, 
  onCloseChat 
}: UserPopupContentProps) => {
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const isOwnProfile = user.id === currentUserId;

  const handleDisconnect = async () => {
    if (!invitationId) return;
    
    setDisconnecting(true);
    
    // Immediately close any open chat drawer
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
          <div className="w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center shadow-md">
            <AvatarDisplay 
              config={user.avatar_config} 
              size={56} 
              showGlow={false}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`font-orbitron font-bold truncate ${
              isConnected ? 'text-success' : 'text-primary'
            }`}>
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
                className={`px-2 py-0.5 rounded border font-mono text-[10px] ${
                  isConnected 
                    ? 'bg-success/20 border-success/30 text-success'
                    : 'bg-primary/20 border-primary/30 text-primary'
                }`}
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

        {/* Action buttons */}
        {!isOwnProfile && (
          isConnected ? (
            <div className="space-y-2 mt-4">
              <Button
                onClick={() => {
                  onOpenChat?.(user.id);
                  onClose();
                }}
                className="w-full bg-success hover:bg-success/90 text-success-foreground font-orbitron text-xs"
                size="sm"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                OPEN CHAT
              </Button>
              <Button
                onClick={handleDisconnect}
                disabled={disconnecting}
                variant="outline"
                className="w-full border-destructive/50 text-destructive hover:bg-destructive/10 font-orbitron text-xs"
                size="sm"
              >
                <UserX className="w-4 h-4 mr-2" />
                {disconnecting ? 'DISCONNECTING...' : 'END CONNECTION'}
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => setInviteModalOpen(true)}
              className="w-full mt-4 bg-warning hover:bg-warning/90 text-warning-foreground font-orbitron text-xs"
              size="sm"
            >
              <Zap className="w-4 h-4 mr-2" />
              SIGNAL OPERATIVE
            </Button>
          )
        )}
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

export default UserPopupContent;
