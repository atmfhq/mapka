import { useState } from 'react';
import { Send, Zap } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface SendInviteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUser: {
    id: string;
    nick: string | null;
    avatar_url: string | null;
  };
  currentUserId: string;
}

const ACTIVITY_OPTIONS = [
  { id: 'coffee', label: 'Coffee', emoji: '☕' },
  { id: 'walk', label: 'Walk', emoji: '🚶' },
  { id: 'gaming', label: 'Gaming', emoji: '🎮' },
  { id: 'food', label: 'Food', emoji: '🍕' },
  { id: 'workout', label: 'Workout', emoji: '💪' },
  { id: 'chat', label: 'Just Chat', emoji: '💬' },
];

const SendInviteModal = ({
  open,
  onOpenChange,
  targetUser,
  currentUserId,
}: SendInviteModalProps) => {
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!selectedActivity) return;
    setSending(true);

    const { error } = await supabase.from('invitations').insert({
      sender_id: currentUserId,
      receiver_id: targetUser.id,
      activity_type: selectedActivity,
      status: 'pending',
    });

    setSending(false);

    if (error) {
      toast({
        title: "Failed to send invitation",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Signal Sent!",
      description: `Invitation sent to ${targetUser.nick || 'operative'}`,
    });
    
    setSelectedActivity(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-primary/30 max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-orbitron text-lg flex items-center gap-2">
            <Zap className="w-5 h-5 text-warning" />
            Signal Operative
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Target user */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
            <Avatar className="w-12 h-12 border-2 border-primary/50">
              <AvatarImage src={targetUser.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/20 text-primary">
                {targetUser.nick?.[0]?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{targetUser.nick || 'Unknown'}</p>
              <p className="text-xs text-muted-foreground">Select activity to invite</p>
            </div>
          </div>

          {/* Activity selection */}
          <div className="grid grid-cols-3 gap-2">
            {ACTIVITY_OPTIONS.map((activity) => (
              <button
                key={activity.id}
                onClick={() => setSelectedActivity(activity.id)}
                className={`p-3 rounded-lg border text-center transition-all ${
                  selectedActivity === activity.id
                    ? 'bg-primary/20 border-primary text-primary'
                    : 'bg-muted/20 border-border/50 hover:border-primary/50'
                }`}
              >
                <span className="text-xl block">{activity.emoji}</span>
                <span className="text-xs font-medium mt-1 block">{activity.label}</span>
              </button>
            ))}
          </div>

          {/* Send button */}
          <Button
            onClick={handleSend}
            disabled={!selectedActivity || sending}
            className="w-full bg-warning hover:bg-warning/90 text-warning-foreground font-orbitron"
          >
            <Send className="w-4 h-4 mr-2" />
            {sending ? 'TRANSMITTING...' : 'SEND SIGNAL'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SendInviteModal;
