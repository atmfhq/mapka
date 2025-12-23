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
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>({
    skinColor: "cyan",
    shape: "circle",
    eyes: "normal",
    mouth: "smile",
  });
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState<string>("");
  
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

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

      await refreshProfile();
      
      toast({
        title: "Operative Initialized",
        description: "Welcome to SquadMap, " + nick,
      });
      
      navigate("/dashboard");
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
    <div className="min-h-screen bg-background tactical-grid flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
      
      <div className="relative z-10 w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Target className="w-6 h-6 text-primary" />
            </div>
          </div>
          <h1 className="font-orbitron text-2xl font-bold mb-2">
            Character <span className="text-primary">Creation</span>
          </h1>
          <p className="font-mono text-sm text-muted-foreground">
            Initialize your operative profile
          </p>
        </div>

        {/* Stepper */}
        <TacticalStepper currentStep={step} steps={steps} />

        {/* Step Content */}
        <TacticalCard className="mb-6 max-h-[60vh] overflow-y-auto">
          {/* Step 0: Identity */}
          {step === 0 && (
            <div className="space-y-6 animate-fade-in-up">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-primary" />
                <h2 className="font-orbitron text-lg font-semibold">Identity Protocol</h2>
              </div>

              {/* Nickname */}
              <div className="space-y-2">
                <Label htmlFor="nick" className="font-mono text-xs uppercase text-muted-foreground">
                  Callsign / Nickname *
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
            <div className="space-y-6 animate-fade-in-up">
              <div className="flex items-center gap-2 mb-4">
                <Heart className="w-5 h-5 text-accent" />
                <h2 className="font-fredoka text-lg font-semibold">What Do You Enjoy?</h2>
              </div>
              
              <p className="text-sm text-muted-foreground mb-4">
                Select activities you're interested in. This helps you find like-minded people nearby.
              </p>

              <InterestSelector 
                selected={selectedTags}
                onChange={setSelectedTags}
              />
            </div>
          )}

          {/* Step 2: Appearance */}
          {step === 2 && (
            <div className="space-y-6 animate-fade-in-up">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-accent" />
                <h2 className="font-fredoka text-lg font-semibold">Create Your Avatar</h2>
              </div>

              <p className="text-sm text-muted-foreground mb-4">
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
            <div className="space-y-6 animate-fade-in-up">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-5 h-5 text-primary" />
                <h2 className="font-fredoka text-lg font-semibold">Where is your Base?</h2>
              </div>

              <p className="text-sm text-muted-foreground mb-4">
                Search for your city, neighborhood, or address. This helps you find people nearby.
              </p>

              {/* Location Search */}
              <LocationSearch 
                onLocationSelect={handleLocationSelect}
                initialValue={locationName}
              />

              {/* Coordinates display when selected */}
              {coords && (
                <div className="mt-4 p-4 bg-muted/30 rounded-xl border-2 border-border">
                  <div className="font-nunito text-sm text-success font-bold mb-2">
                    ✓ Location Set
                  </div>
                  <div className="font-nunito text-xs text-muted-foreground">
                    {locationName && <div className="mb-1 text-foreground">{locationName}</div>}
                    LAT: {coords.lat.toFixed(6)} | LNG: {coords.lng.toFixed(6)}
                  </div>
                </div>
              )}

              {/* Privacy warning */}
              <div className="flex items-start gap-3 p-4 rounded-xl bg-warning/10 border-2 border-warning/30">
                <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-nunito font-bold text-warning mb-1">
                    Privacy Notice
                  </div>
                  <p className="font-nunito text-xs text-muted-foreground">
                    Your exact location is private. Others will only see you within a 400m radius of this point.
                  </p>
                </div>
              </div>
            </div>
          )}
        </TacticalCard>

        {/* Navigation */}
        <div className="flex justify-between">
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
              variant="forest"
              onClick={handleSubmit}
              disabled={loading || !coords}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Initializing...
                </>
              ) : (
                <>
                  <Target className="w-4 h-4" />
                  Initialize Operative
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
