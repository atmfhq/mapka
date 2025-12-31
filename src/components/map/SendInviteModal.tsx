import { useState } from 'react';
import { Send, UserPlus, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import AvatarDisplay from '@/components/avatar/AvatarDisplay';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface AvatarConfig {
  skinColor?: string;
  shape?: string;
  eyes?: string;
  mouth?: string;
}

interface SendInviteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUser: {
    id: string;
    nick: string | null;
    avatar_url: string | null;
    avatar_config?: AvatarConfig | null;
    tags?: string[] | null;
  };
  currentUserId: string;
}

const SendInviteModal = ({
  open,
  onOpenChange,
  targetUser,
  currentUserId,
}: SendInviteModalProps) => {
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    setSending(true);

    // Simple connection request - no category needed
    const { error } = await supabase.from('invitations').insert({
      sender_id: currentUserId,
      receiver_id: targetUser.id,
      activity_type: 'connection', // Default value for direct connections
      status: 'pending',
    });

    setSending(false);

    if (error) {
      // Check if it's a duplicate invitation
      if (error.code === '23505' || error.message.includes('duplicate')) {
        toast({
          title: "Already Connected",
          description: `You already have a pending or active connection with ${targetUser.nick || 'this user'}.`,
          variant: "default",
        });
      } else {
        toast({
          title: "Failed to send request",
          description: error.message,
          variant: "destructive",
        });
      }
      return;
    }

    toast({
      title: "Connection Request Sent!",
      description: `${targetUser.nick || 'User'} will be notified.`,
    });
    
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-primary/30 max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-fredoka text-lg flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Connect with {targetUser.nick || 'User'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Send a connection request to start a conversation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Target user profile */}
          <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30 border border-border/50">
            <div className="w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center border-2 border-primary/50">
              <AvatarDisplay 
                config={targetUser.avatar_config} 
                size={56} 
                showGlow={false}
              />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-lg">{targetUser.nick || 'Unknown'}</p>
              {targetUser.tags && targetUser.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {targetUser.tags.slice(0, 3).map((tag, i) => (
                    <span 
                      key={i} 
                      className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary"
                    >
                      {tag}
                    </span>
                  ))}
                  {targetUser.tags.length > 3 && (
                    <span className="text-xs text-muted-foreground">
                      +{targetUser.tags.length - 3} more
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Simple explanation */}
          <p className="text-sm text-muted-foreground text-center">
            Once accepted, you'll be able to chat directly.
          </p>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={sending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={sending}
              className="flex-1 font-fredoka"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Request
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SendInviteModal;
