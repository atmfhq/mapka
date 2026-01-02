import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Mail, ExternalLink } from "lucide-react";

interface AboutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AboutModal = ({ open, onOpenChange }: AboutModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto bg-card border-border/50 rounded-2xl p-6">
        <DialogHeader className="flex flex-col items-center space-y-3 pb-2">
          {/* App Logo */}
          <img 
            src="/assets/cursors/spawn-cursor.svg" 
            alt="Mapka Logo" 
            className="w-16 h-16"
          />
          
          {/* App Name */}
          <DialogTitle className="text-2xl font-bold tracking-tight" style={{ fontFamily: 'Fredoka, sans-serif' }}>
            Mapka
          </DialogTitle>
          
          {/* Tagline */}
          <p className="text-muted-foreground text-sm">Find Your Spot</p>
        </DialogHeader>

        <Separator className="my-4" />

        {/* About Section */}
        <div className="space-y-4 text-center">
          <p className="text-sm text-foreground/90">
            Connecting the local community through shared experiences and real-time discovery.
          </p>
          
          <p className="text-xs text-muted-foreground">
            Built with ❤️ by the Mapka Team
          </p>

          {/* Contact */}
          <a 
            href="mailto:contact@mapka.app" 
            className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
          >
            <Mail className="w-4 h-4" />
            contact@mapka.app
          </a>
        </div>

        <Separator className="my-4" />

        {/* Mini FAQ */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">FAQ</h3>
          
          <div className="space-y-2 text-sm">
            <div>
              <p className="font-medium text-foreground/90">Is Mapka free?</p>
              <p className="text-muted-foreground text-xs">Yes, completely free to use!</p>
            </div>
            
            <div>
              <p className="font-medium text-foreground/90">What is Guest Mode?</p>
              <p className="text-muted-foreground text-xs">Browse the map and discover spots without creating an account.</p>
            </div>
            
            <div>
              <p className="font-medium text-foreground/90">How do I create a Spot?</p>
              <p className="text-muted-foreground text-xs">Tap anywhere on the map and select "Create Spot" from the menu.</p>
            </div>
          </div>
        </div>

        <Separator className="my-4" />

        {/* Footer Links */}
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <a 
            href="/privacy" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors inline-flex items-center gap-1"
          >
            Privacy Policy
            <ExternalLink className="w-3 h-3" />
          </a>
          <span>•</span>
          <a 
            href="/terms" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors inline-flex items-center gap-1"
          >
            Terms of Service
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AboutModal;
