import { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ShoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  coords: { lat: number; lng: number };
  userId: string;
  onShoutCreated: () => void;
}

const ShoutModal = ({ isOpen, onClose, coords, userId, onShoutCreated }: ShoutModalProps) => {
  const { toast } = useToast();
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const maxLength = 280;

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast({
        title: 'Empty shout',
        description: 'Please write something to shout!',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('shouts').insert({
        user_id: userId,
        content: content.trim(),
        lat: coords.lat,
        lng: coords.lng,
      });

      if (error) throw error;

      toast({
        title: 'Shout posted!',
        description: 'Your shout will be visible for 24 hours.',
      });

      setContent('');
      onShoutCreated();
      onClose();
    } catch (error: any) {
      console.error('Failed to create shout:', error);
      toast({
        title: 'Failed to post shout',
        description: error.message || 'Something went wrong.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-transparent"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-card border-2 border-border rounded-2xl shadow-hard w-full max-w-sm animate-in zoom-in-95 fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent/20 border border-accent/40 flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h3 className="font-nunito font-bold text-foreground">New Shout</h3>
              <p className="text-xs text-muted-foreground">Visible on the map for 24h</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <Textarea
              placeholder="What's on your mind?"
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, maxLength))}
              className="min-h-[100px] resize-none bg-muted/50 border-border focus:border-accent"
              autoFocus
            />
            <div className="flex justify-end">
              <span className={`text-xs ${content.length >= maxLength ? 'text-destructive' : 'text-muted-foreground'}`}>
                {content.length}/{maxLength}
              </span>
            </div>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !content.trim()}
            className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
          >
            {isSubmitting ? 'Posting...' : 'Shout it!'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ShoutModal;
