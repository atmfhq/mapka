import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Json } from "@/integrations/supabase/types";
import TacticalCard from "@/components/TacticalCard";
import TacticalStepper from "@/components/TacticalStepper";
import InterestSelector from "@/components/InterestSelector";
import AvatarBuilder from "@/components/avatar/AvatarBuilder";
import LocationSearch from "@/components/LocationSearch";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useKeyboardAvoidance } from "@/hooks/useKeyboardAvoidance";
import { ACTIVITIES } from "@/constants/activities";
import { 
  User, 
  MapPin, 
  Target, 
  Shield, 
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Sparkles,
  Heart
} from "lucide-react";
import { generateRandomAvatar } from "@/utils/randomAvatar";

interface AvatarConfig {
  skinColor?: string;
  shape?: string;
  eyes?: string;
  mouth?: string;
}

const Onboarding = () => {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [nick, setNick] = useState("");
  const [bio, setBio] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  // Generate a random avatar on component mount
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>(() => generateRandomAvatar());
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState<string>("");
  const [spawnIntentCoords, setSpawnIntentCoords] = useState<{ lat: number; lng: number } | null>(null);
  
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const keyboardRef = useKeyboardAvoidance();

  // Check for spawn intent coordinates from sessionStorage
  useEffect(() => {
    const storedSpawnCoords = sessionStorage.getItem('spawn_intent_coords');
    if (storedSpawnCoords) {
      try {
        const parsed = JSON.parse(storedSpawnCoords);
        if (parsed.lat && parsed.lng) {
          setSpawnIntentCoords(parsed);
        }
      } catch (e) {
        console.error('Failed to parse spawn_intent_coords:', e);
        sessionStorage.removeItem('spawn_intent_coords');
      }
    }
  }, []);

  // Redirect already onboarded users to dashboard
  useEffect(() => {
    if (!authLoading && profile?.is_onboarded) {
      navigate("/dashboard", { replace: true });
    }
  }, [authLoading, profile, navigate]);

  const steps = [
    { label: "Identity", icon: <User className="w-5 h-5" /> },
    { label: "Interests", icon: <Heart className="w-5 h-5" /> },
    { label: "Appearance", icon: <Sparkles className="w-5 h-5" /> },
    { label: "Base", icon: <MapPin className="w-5 h-5" /> },
  ];

  const handleLocationSelect = (location: { lat: number; lng: number; name: string }) => {
    setCoords({ lat: location.lat, lng: location.lng });
    setLocationName(location.name);
  };

  const handleNextStep = () => {
    if (step === 0) {
      if (!nick.trim()) {
        toast({
          title: "Nickname Required",
          description: "Every operative needs a callsign",
          variant: "destructive",
        });
        return;
      }
    }
    
    if (step === 1) {
      if (selectedTags.length === 0) {
        toast({
          title: "Select Interests",
          description: "Choose at least one activity you enjoy",
          variant: "destructive",
        });
        return;
      }
    }
    
    setStep(step + 1);
  };

  const handleSubmit = async () => {
    if (!coords) {
      toast({
        title: "Base Location Required",
        description: "Establish your base coordinates first",
        variant: "destructive",
      });
      return;
    }

    if (!user) return;

    setLoading(true);
    try {
      // Map activity IDs to labels for the tags
      const tagLabels = selectedTags.map(
        (id) => ACTIVITIES.find((a) => a.id === id)?.label || id
      );

      const { error } = await supabase
        .from("profiles")
        .update({
          nick: nick.trim(),
          bio: bio.trim() || null,
          avatar_config: avatarConfig as Json,
          tags: tagLabels,
          location_lat: coords.lat,
          location_lng: coords.lng,
          location_name: locationName || null,
          is_onboarded: true,
        })
        .eq("id", user.id);

      if (error) throw error;

      // Clear spawn intent coords from storage after successful profile creation
      sessionStorage.removeItem('spawn_intent_coords');

      await refreshProfile();
      
      toast({
        title: "Welcome to Mapka!",
        description: "Your adventure begins now, " + nick,
      });
      
      navigate("/");
    } catch (error: any) {
      toast({
        title: "Initialization Failed",
        description: error.message || "Could not save profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={keyboardRef} className="min-h-dvh overflow-y-auto flex items-center justify-center p-4">
      {/* Background with gradient and subtle pattern */}
      <div className="fixed inset-0 bg-gradient-to-br from-primary/20 via-background to-accent/20" />
      <div className="fixed inset-0 opacity-30" style={{ 
        backgroundImage: `radial-gradient(circle at 25% 25%, hsl(var(--primary) / 0.1) 0%, transparent 50%), 
                          radial-gradient(circle at 75% 75%, hsl(var(--accent) / 0.1) 0%, transparent 50%)` 
      }} />
      
      {/* Centered Card Modal */}
      <div className="relative z-10 w-full max-w-lg">
        <div className="bg-background border-2 border-border rounded-2xl shadow-hard overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-border/50 text-center">
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-primary/20 border-2 border-primary/40 flex items-center justify-center shadow-hard-sm">
                <Target className="w-6 h-6 text-primary" />
              </div>
            </div>
            <h1 className="font-fredoka text-2xl font-bold mb-1">
              Create Your <span className="text-primary">Profile</span>
            </h1>
            <p className="font-nunito text-sm text-muted-foreground">
              {steps[step].label} • Step {step + 1} of {steps.length}
            </p>
          </div>

          {/* Stepper - Compact */}
          <div className="px-6 pt-4">
            <TacticalStepper currentStep={step} steps={steps} />
          </div>

          {/* Content */}
          <div className="p-6 max-h-[50vh] overflow-y-auto">
            {/* Step 0: Identity */}
            {step === 0 && (
              <div className="space-y-5 animate-fade-in">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="w-5 h-5 text-primary" />
                  <h2 className="font-nunito text-lg font-semibold">Your Identity</h2>
                </div>

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
                    rows={3}
                    className="bg-muted/50 border-2 border-border focus:border-primary font-nunito rounded-xl resize-none"
                  />
                </div>
              </div>
            )}

            {/* Step 1: Interests */}
            {step === 1 && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="w-5 h-5 text-accent" />
                  <h2 className="font-nunito text-lg font-semibold">What Do You Enjoy?</h2>
                </div>
                
                <p className="text-sm text-muted-foreground">
                  Select activities you're interested in. This helps you find like-minded people.
                </p>

                <InterestSelector 
                  selected={selectedTags}
                  onChange={setSelectedTags}
                />
              </div>
            )}

            {/* Step 2: Appearance */}
            {step === 2 && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-5 h-5 text-accent" />
                  <h2 className="font-nunito text-lg font-semibold">Create Your Avatar</h2>
                </div>

                <p className="text-sm text-muted-foreground">
                  Customize your look. This is how others will see you on the map.
                </p>

                <AvatarBuilder 
                  initialConfig={avatarConfig}
                  onChange={setAvatarConfig}
                />
              </div>
            )}

            {/* Step 3: Location */}
            {step === 3 && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  <h2 className="font-nunito text-lg font-semibold">Set your location</h2>
                </div>

                <p className="text-sm text-muted-foreground">
                  Search for your city, neighborhood, or address.
                </p>

                {/* Location Search */}
                <LocationSearch 
                  onLocationSelect={handleLocationSelect}
                  initialValue={locationName}
                  initialCoords={spawnIntentCoords}
                  fromSpawnIntent={!!spawnIntentCoords}
                />

                {/* Coordinates display when selected */}
                {coords && (
                  <div className="p-3 bg-success/10 rounded-xl border border-success/30">
                    <div className="font-nunito text-sm text-success font-bold mb-1">
                      ✓ Location Set
                    </div>
                    <div className="font-nunito text-xs text-muted-foreground">
                      {locationName && <div className="text-foreground">{locationName}</div>}
                    </div>
                  </div>
                )}

                {/* Privacy Warning - Compact */}
                <div className="flex items-start gap-2 p-3 rounded-xl bg-warning/10 border border-warning/30">
                  <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-nunito font-semibold text-warning text-sm mb-1">
                      Privacy Tip
                    </div>
                    <p className="font-nunito text-xs text-muted-foreground">
                      Choose a nearby landmark instead of your exact address.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer - Navigation */}
          <div className="flex justify-between items-center p-6 border-t border-border/50 bg-muted/30">
            {step > 0 ? (
              <Button variant="ghost" onClick={() => setStep(step - 1)}>
                <ChevronLeft className="w-4 h-4" />
                Back
              </Button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <Button variant="default" onClick={handleNextStep}>
                Continue
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                variant="default"
                onClick={handleSubmit}
                disabled={loading || !coords}
                className="bg-success hover:bg-success/90 text-success-foreground"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <MapPin className="w-4 h-4" />
                    Enter Map
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
