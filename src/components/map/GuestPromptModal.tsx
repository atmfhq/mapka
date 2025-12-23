import { useNavigate } from 'react-router-dom';
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
  variant: 'join' | 'connect' | 'create';
}

const VARIANT_CONFIG = {
  join: {
    title: 'Join the Quest!',
    description: 'Sign in to join quests, chat with adventurers, and explore together.',
    icon: Sparkles,
  },
  connect: {
    title: 'Connect with Adventurers',
    description: 'Sign in to send invites, start conversations, and build your party.',
    icon: UserPlus,
  },
  create: {
    title: 'Start Your Adventure',
    description: 'Sign in to place your own quests on the map and gather fellow adventurers!',
    icon: Sparkles,
  },
};

const GuestPromptModal = ({ open, onOpenChange, variant }: GuestPromptModalProps) => {
  const navigate = useNavigate();
  const config = VARIANT_CONFIG[variant];
  const Icon = config.icon;

  const handleSignIn = () => {
    onOpenChange(false);
    navigate('/auth');
  };

  const handleSignUp = () => {
    onOpenChange(false);
    navigate('/auth');
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
            onClick={handleSignUp}
            size="lg"
            className="w-full font-fredoka min-h-[52px]"
          >
            <UserPlus className="w-5 h-5 mr-2" />
            Create Account
          </Button>
          <Button
            onClick={handleSignIn}
            variant="outline"
            size="lg"
            className="w-full font-nunito min-h-[48px]"
          >
            <LogIn className="w-5 h-5 mr-2" />
            I already have an account
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center pt-2">
          It only takes a minute to join the adventure!
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default GuestPromptModal;
