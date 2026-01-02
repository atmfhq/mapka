import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DeleteEventConfirmationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isOfficial?: boolean;
  loading?: boolean;
}

const DeleteEventConfirmation = ({
  open,
  onOpenChange,
  onConfirm,
  isOfficial = false,
  loading = false,
}: DeleteEventConfirmationProps) => {
  const [confirmText, setConfirmText] = useState('');

  const isConfirmEnabled = confirmText.toLowerCase() === 'delete';
  const eventType = isOfficial ? 'official event' : 'spot';

  const handleConfirm = () => {
    if (isConfirmEnabled) {
      onConfirm();
      setConfirmText('');
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setConfirmText('');
    }
    onOpenChange(newOpen);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="bg-card border-destructive/30 max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-fredoka text-lg text-destructive">
            Delete {isOfficial ? 'Official Event' : 'Spot'}?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-foreground">
            This action cannot be undone. This will permanently delete the {eventType} and remove all participants.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="delete-confirm" className="text-sm font-medium text-foreground">
            Type <span className="font-bold text-destructive">delete</span> to confirm
          </Label>
          <Input
            id="delete-confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="delete"
            className="bg-muted/50 border-border focus:border-destructive"
            autoComplete="off"
            autoFocus
          />
        </div>

        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel 
            className="border-border"
            disabled={loading}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!isConfirmEnabled || loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteEventConfirmation;
