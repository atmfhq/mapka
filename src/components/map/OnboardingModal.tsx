import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import AvatarBuilder from '@/components/avatar/AvatarBuilder';
import AvatarDisplay from '@/components/avatar/AvatarDisplay';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
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
  const [bio, setBio] = useState('');
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>(() => generateRandomAvatar());
  const [loading, setLoading] = useState(false);
  const [showAvatarBuilder, setShowAvatarBuilder] = useState(false);
  
  const { user, refreshProfile } = useAuth();
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
        bio: bio.trim() || null,
        avatar_config: avatarConfig as Json,
        is_onboarded: true,
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

      await refreshProfile();
      
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-md border-2 border-border max-h-[85vh] overflow-y-auto">
        <DialogHeader className="text-center">
          {/* Logo - Pin Icon */}
          <div className="mx-auto mb-4">
            <img 
              src="/icon.svg" 
              alt="Mapka" 
              className="w-14 h-14 mx-auto"
            />
          </div>
          
          {/* Monochrome Logo Text */}
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

          {/* Bio */}
          <div className="space-y-2">
            <Label htmlFor="bio" className="font-nunito text-sm font-medium text-foreground">
              Bio ({bio.length}/150)
            </Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 150))}
              placeholder="Tell us about yourself..."
              rows={2}
              className="bg-muted/50 border-2 border-border focus:border-primary font-nunito rounded-xl resize-none"
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
              </div>
            )}
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={loading || !nick.trim()}
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
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingModal;
