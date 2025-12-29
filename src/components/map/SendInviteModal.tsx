import { useState, useEffect } from 'react';
import { Send, Zap, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import AvatarDisplay from '@/components/avatar/AvatarDisplay';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { getActivityById, Activity, ACTIVITIES } from '@/constants/activities';

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
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [matchingActivities, setMatchingActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  // Find matching activities based on target user's tags
  useEffect(() => {
    if (!open) return;
    
    setLoading(true);
    
    const userTags = targetUser.tags || [];
    
    if (userTags.length === 0) {
      // No tags - show all activities
      setMatchingActivities(ACTIVITIES);
    } else {
      // Filter activities that match user's tags (case insensitive)
      const lowerTags = userTags.map(t => t.toLowerCase());
      const matched = ACTIVITIES.filter(activity => 
        lowerTags.includes(activity.label.toLowerCase())
      );
      
      // If no exact matches, show all
      setMatchingActivities(matched.length > 0 ? matched : ACTIVITIES);
    }
    
    setLoading(false);
    setSelectedActivity(null);
  }, [open, targetUser.tags]);

  const handleSend = async () => {
    if (!selectedActivity) return;
    setSending(true);

    const activityData = getActivityById(selectedActivity);

    const { error } = await supabase.from('invitations').insert({
      sender_id: currentUserId,
      receiver_id: targetUser.id,
      activity_type: activityData?.label || selectedActivity,
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

  const hasMatchingInterests = matchingActivities.length > 0 && (targetUser.tags?.length || 0) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-primary/30 max-w-sm max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-fredoka text-lg flex items-center gap-2">
            <Zap className="w-5 h-5 text-warning" />
            Send Invite
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Target user */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
            <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center border-2 border-primary/50">
              <AvatarDisplay 
                config={targetUser.avatar_config} 
                size={48} 
                showGlow={false}
              />
            </div>
            <div>
              <p className="font-semibold">{targetUser.nick || 'Unknown'}</p>
              <p className="text-xs text-muted-foreground">
                {hasMatchingInterests 
                  ? `${matchingActivities.length} matching interests found`
                  : 'Select activity to invite'}
              </p>
            </div>
          </div>

          {/* Signal protocol indicator */}
          {hasMatchingInterests && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-success/10 border border-success/30">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-xs text-success font-nunito font-medium">
                Matching interests found!
              </span>
            </div>
          )}

          {/* Activity selection */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {matchingActivities.map((activity) => (
                <button
                  key={activity.id}
                  onClick={() => setSelectedActivity(activity.id)}
                  className={`p-3 rounded-lg border text-center transition-all ${
                    selectedActivity === activity.id
                      ? 'bg-primary/20 border-primary text-primary shadow-[0_0_10px_hsl(var(--primary)/0.3)]'
                      : 'bg-muted/20 border-border/50 hover:border-primary/50'
                  }`}
                >
                  <span className="text-xl block">{activity.icon}</span>
                  <span className="text-xs font-medium mt-1 block truncate">{activity.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Send button */}
          <Button
            onClick={handleSend}
            disabled={!selectedActivity || sending}
            className="w-full bg-warning hover:bg-warning/90 text-warning-foreground font-fredoka"
          >
            <Send className="w-4 h-4 mr-2" />
            {sending ? 'Sending...' : 'Send Invite'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SendInviteModal;
