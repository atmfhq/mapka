import { LogIn, UserPlus, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface GuestPromptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: 'join' | 'connect' | 'create' | 'view';
  onOpenAuthModal?: () => void;
}

const VARIANT_CONFIG = {
  join: {
    title: 'Join the Community!',
    description: 'Sign in to join events, chat with people, and explore together.',
    icon: Sparkles,
  },
  connect: {
    title: 'Connect with People',
    description: 'Sign in to send invites, start conversations, and meet new friends.',
    icon: UserPlus,
  },
  create: {
    title: 'Set Your Location!',
    description: 'Sign in to appear on the map and start connecting with people nearby.',
    icon: Sparkles,
  },
  view: {
    title: 'Unlock Full Access',
    description: 'Log in to view details, comments, and connect with users.',
    icon: LogIn,
  },
};

const GuestPromptModal = ({ open, onOpenChange, variant, onOpenAuthModal }: GuestPromptModalProps) => {
  const config = VARIANT_CONFIG[variant];
  const Icon = config.icon;

  const handleAuth = () => {
    onOpenChange(false);
    // Small delay to allow modal to close before opening auth modal
    setTimeout(() => {
      onOpenAuthModal?.();
    }, 100);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/20 border-2 border-primary/40 flex items-center justify-center mb-4">
            <Icon className="w-8 h-8 text-primary" />
          </div>
          <DialogTitle className="font-fredoka text-xl text-center">
            {config.title}
          </DialogTitle>
          <DialogDescription className="font-nunito text-center">
            {config.description}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 pt-4">
          <Button
            onClick={handleAuth}
            size="lg"
            className="w-full font-fredoka min-h-[52px]"
          >
            <UserPlus className="w-5 h-5 mr-2" />
            Create Account
          </Button>
          <Button
            onClick={handleAuth}
            variant="outline"
            size="lg"
            className="w-full font-nunito min-h-[48px]"
          >
            <LogIn className="w-5 h-5 mr-2" />
            I already have an account
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center pt-2">
          It only takes a minute to get started!
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default GuestPromptModal;
