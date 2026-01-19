import { useState } from 'react';
import { Dices, Loader2, Sparkles, AlertTriangle, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AvatarBuilder from '@/components/avatar/AvatarBuilder';
import AvatarDisplay from '@/components/avatar/AvatarDisplay';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { broadcastCurrentUserUpdate } from '@/hooks/useProfilesRealtime';
import { generateRandomAvatar } from '@/utils/randomAvatar';
import type { Json } from '@/integrations/supabase/types';

interface AvatarConfig {
  skinColor?: string;
  shape?: string;
  eyes?: string;
  mouth?: string;
}

interface OnboardingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
  spawnCoordinates?: { lat: number; lng: number } | null;
}

const OnboardingModal = ({ open, onOpenChange, onComplete, spawnCoordinates }: OnboardingModalProps) => {
  const [nick, setNick] = useState('');
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>(() => generateRandomAvatar());
  const [loading, setLoading] = useState(false);
  const [showAvatarBuilder, setShowAvatarBuilder] = useState(false);
  const [is18PlusConfirmed, setIs18PlusConfirmed] = useState(false);
  const [wasCompleted, setWasCompleted] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  
  const { user, refreshProfile, signOut } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!nick.trim()) {
      toast({
        title: 'Nickname Required',
        description: 'Please enter a nickname',
        variant: 'destructive',
      });
      return;
    }

    if (!user) return;

    setLoading(true);
    try {
      // Get spawn coordinates from prop or localStorage (for OAuth redirects)
      let coords = spawnCoordinates;
      if (!coords) {
        const storedCoords = localStorage.getItem('mapka_spawn_coords');
        if (storedCoords) {
          try {
            coords = JSON.parse(storedCoords);
            localStorage.removeItem('mapka_spawn_coords');
          } catch (e) {
            console.error('Failed to parse spawn coords:', e);
          }
        }
      }

      const updateData: Record<string, any> = {
        nick: nick.trim(),
        avatar_config: avatarConfig as Json,
        is_onboarded: true,
        is_18_plus: true,
      };

      // Set initial location if we have spawn coordinates
      if (coords?.lat && coords?.lng) {
        updateData.location_lat = coords.lat;
        updateData.location_lng = coords.lng;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (error) throw error;

      // Mark as completed before refreshing profile
      setWasCompleted(true);
      
      // Wait for profile to refresh to ensure state is updated
      await refreshProfile();

      // Broadcast to other users that this user just appeared
      if (coords?.lat && coords?.lng) {
        await broadcastCurrentUserUpdate(user.id, coords.lat, coords.lng, 'location_update');
      }

      // Small delay to ensure profile state propagates
      await new Promise(resolve => setTimeout(resolve, 100));
      
      toast({
        title: 'Welcome to Mapka!',
        description: 'Tap anywhere on the map to set your location',
      });
      
      onOpenChange(false);
      onComplete?.();
    } catch (error: any) {
      toast({
        title: 'Failed to save',
        description: error.message || 'Could not save profile',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Block modal from closing unless onboarding is completed
  const handleOpenChange = (isOpen: boolean) => {
    // Only allow closing if onboarding was successfully completed
    if (!isOpen && wasCompleted) {
      // Reset form state
      setNick('');
      setIs18PlusConfirmed(false);
      setShowAvatarBuilder(false);
      setWasCompleted(false);
      onOpenChange(false);
    }
    // Ignore attempts to close if onboarding is not completed
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    
    setDeletingAccount(true);
    try {
      // Call the security definer RPC function to delete the account
      const { error } = await supabase.rpc('delete_user_account');
      
      if (error) throw error;
      
      // Clear local session
      await signOut();
      
      toast({
        title: "Account Deleted",
        description: "Your account and all data have been permanently removed.",
      });
      
      // Close modal and navigate to home
      setWasCompleted(true);
      onOpenChange(false);
    } catch (error: any) {
      console.error('Account deletion failed:', error);
      toast({
        title: "Deletion Failed",
        description: error.message || "Could not delete account. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeletingAccount(false);
      setDeleteConfirmOpen(false);
      setDeleteConfirmText('');
    }
  };

  const handleRandomizeAvatar = () => {
    setAvatarConfig(generateRandomAvatar());
  };

  return (
    <>
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent 
        className="sm:max-w-md bg-card/95 backdrop-blur-md border-2 border-border max-h-[85vh] overflow-y-auto [&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-center">
          {/* Logo - Orange Pin Icon */}
          <div className="mx-auto mb-4">
            <img 
              src="/pin-logo.svg" 
              alt="Mapka" 
              className="w-14 h-14 mx-auto"
            />
          </div>
          
          {/* Capitalized Logo Text */}
          <DialogTitle className="font-fredoka text-2xl text-center">
            Create Your Profile
          </DialogTitle>
          <DialogDescription className="font-nunito text-center">
            Set up your identity on the map
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Nickname */}
          <div className="space-y-2">
            <Label htmlFor="nick" className="font-nunito text-sm font-medium text-foreground">
              Nickname *
            </Label>
            <Input
              id="nick"
              value={nick}
              onChange={(e) => setNick(e.target.value)}
              placeholder="Enter your name"
              maxLength={30}
              className="bg-muted/50 border-2 border-border focus:border-primary font-nunito rounded-xl"
            />
          </div>

          {/* Avatar Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="font-nunito text-sm font-medium text-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent" />
                Your Avatar
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAvatarBuilder(!showAvatarBuilder)}
                className="text-xs"
              >
                {showAvatarBuilder ? 'Hide' : 'Customize'}
              </Button>
            </div>
            
            {showAvatarBuilder ? (
              <AvatarBuilder 
                initialConfig={avatarConfig}
                onChange={setAvatarConfig}
                compact
              />
            ) : (
              <div className="flex justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div 
                    className="cursor-pointer hover:scale-105 transition-transform"
                    onClick={() => setShowAvatarBuilder(true)}
                  >
                    <AvatarDisplay 
                      config={avatarConfig}
                      size={80}
                      showGlow
                    />
                  </div>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={handleRandomizeAvatar}
                          className="h-9 w-9 rounded-full bg-card/80 backdrop-blur-sm border border-border shadow-hard-sm hover:bg-muted/60"
                          aria-label="Losuj ponownie"
                        >
                          <Dices className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">Losuj ponownie</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            )}
          </div>

          {/* Age Gate Checkbox */}
          <div className="flex items-start space-x-2 pt-2">
            <Checkbox
              id="age-gate"
              checked={is18PlusConfirmed}
              onCheckedChange={(checked) => setIs18PlusConfirmed(checked === true)}
              className="mt-0.5"
            />
            <Label
              htmlFor="age-gate"
              className="text-sm font-nunito leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              I confirm I am 18 years or older and I accept the community rules.
            </Label>
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={loading || !nick.trim() || !is18PlusConfirmed}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Start Exploring'
            )}
          </Button>

          <p className="text-center text-muted-foreground text-xs font-nunito">
            Tap anywhere on the map to set your location
          </p>

          {/* Delete Account Button */}
          <div className="pt-4 border-t border-border/30">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteConfirmOpen(true)}
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 justify-center gap-2"
              disabled={loading || deletingAccount}
            >
              <Trash2 className="w-4 h-4" />
              Delete Account
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Delete Account Confirmation Dialog */}
    <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
      <AlertDialogContent className="bg-card border-destructive/30">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-fredoka flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Delete Account Permanently?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <p>
              This action cannot be undone. This will permanently delete your account, profile, all connections, events you've hosted, and remove all your data from our servers.
            </p>
            <div className="space-y-2 pt-2">
              <Label htmlFor="delete-confirm" className="text-sm font-medium text-foreground">
                Type <span className="font-mono font-bold text-destructive">delete</span> to confirm
              </Label>
              <Input
                id="delete-confirm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value.toLowerCase())}
                placeholder="Type 'delete' here"
                className="bg-muted/50 border-2 border-border focus:border-destructive"
                autoComplete="off"
              />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={() => {
              setDeleteConfirmOpen(false);
              setDeleteConfirmText('');
            }}
          >
            Cancel
          </AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDeleteAccount}
            disabled={deleteConfirmText !== "delete" || deletingAccount}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deletingAccount ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Deleting...
              </>
            ) : (
              "Yes, Delete My Account"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
};

export default OnboardingModal;
