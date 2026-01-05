import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Flag, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

type ReportTarget =
  | { type: 'shout'; id: string; label?: string }
  | { type: 'event'; id: string; label?: string } // events are stored in public.megaphones
  | { type: 'user'; id: string; label?: string };

interface ReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string | null;
  target: ReportTarget | null;
  onOpenAuthModal?: () => void;
}

const REASONS = [
  { value: 'spam', label: 'Spam / Scam' },
  { value: 'harassment', label: 'Harassment / Hate' },
  { value: 'sexual', label: 'Sexual content' },
  { value: 'violence', label: 'Violence / Threats' },
  { value: 'illegal', label: 'Illegal activity' },
  { value: 'other', label: 'Other' },
] as const;

const ReportModal = ({ open, onOpenChange, currentUserId, target, onOpenAuthModal }: ReportModalProps) => {
  const [reasonCategory, setReasonCategory] = useState<(typeof REASONS)[number]['value']>('spam');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const targetTitle = useMemo(() => {
    if (!target) return 'Report';
    if (target.type === 'shout') return 'Report shout';
    if (target.type === 'event') return 'Report event';
    return 'Report user';
  }, [target]);

  const handleClose = () => onOpenChange(false);

  const handleSubmit = async () => {
    if (!target) return;

    if (!currentUserId) {
      handleClose();
      onOpenAuthModal?.();
      return;
    }

    const reasonLabel = REASONS.find(r => r.value === reasonCategory)?.label ?? reasonCategory;
    const trimmedDetails = details.trim().slice(0, 500);
    const composedReason = trimmedDetails ? `${reasonLabel}: ${trimmedDetails}` : reasonLabel;

    setSubmitting(true);
    try {
      const insertPayload: any = {
        reporter_id: currentUserId,
        reason: composedReason,
        target_shout_id: null,
        target_event_id: null,
        target_user_id: null,
      };

      if (target.type === 'shout') insertPayload.target_shout_id = target.id;
      if (target.type === 'event') insertPayload.target_event_id = target.id;
      if (target.type === 'user') insertPayload.target_user_id = target.id;

      const { error } = await supabase.from('reports').insert(insertPayload);
      if (error) throw error;

      toast({
        title: 'Report submitted',
        description: 'Thanks — this helps keep the space safe.',
      });
      setDetails('');
      setReasonCategory('spam');
      handleClose();
    } catch (err: any) {
      // Postgres unique violation (duplicate report for same target by same reporter)
      const code = err?.code as string | undefined;
      if (code === '23505') {
        toast({
          title: 'Already reported',
          description: 'You already reported this.',
        });
      } else {
        toast({
          title: 'Failed to submit report',
          description: err?.message || 'Something went wrong.',
          variant: 'destructive',
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !target) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4" style={{ isolation: 'isolate' }}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-transparent" onClick={handleClose} />

      {/* Modal */}
      <div className="relative bg-card border-2 border-border rounded-t-2xl sm:rounded-2xl shadow-hard w-full sm:max-w-md max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in-95 fade-in duration-200 z-10">
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center">
              <Flag className="w-5 h-5 text-destructive" />
            </div>
            <div className="min-w-0">
              <h3 className="font-nunito font-bold text-foreground">{targetTitle}</h3>
              <p className="text-xs text-muted-foreground truncate">
                {target.label || 'Tell us what’s wrong'}
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

        <div className="p-4 space-y-4 overflow-auto">
          <div className="space-y-2">
            <Label className="text-xs font-nunito font-medium text-muted-foreground">Reason</Label>
            <Select value={reasonCategory} onValueChange={(v) => setReasonCategory(v as any)}>
              <SelectTrigger className="bg-muted/50 border-border/50">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent className="z-[100000]">
                {REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-nunito font-medium text-muted-foreground">Details (optional)</Label>
            <Textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Add a short note (optional)"
              className="bg-muted/50 border-border/50 min-h-[90px] resize-none"
              maxLength={500}
            />
            <div className="flex justify-end">
              <span className="text-[10px] text-muted-foreground">{details.length}/500</span>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border shrink-0">
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full min-h-[48px]"
            variant="destructive"
          >
            {submitting ? 'Submitting…' : 'Submit report'}
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default ReportModal;


