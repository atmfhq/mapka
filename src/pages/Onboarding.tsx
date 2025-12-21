import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import TacticalCard from "@/components/TacticalCard";
import TacticalStepper from "@/components/TacticalStepper";
import InterestChip from "@/components/InterestChip";
import AvatarSelector from "@/components/AvatarSelector";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  User, 
  MapPin, 
  Target, 
  Crosshair, 
  Shield, 
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Loader2
} from "lucide-react";

// Preset avatars - cyberpunk/tactical themed
const AVATAR_OPTIONS = [
  { id: "ghost", url: "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=ghost&backgroundColor=0a0a0a", label: "Ghost" },
  { id: "cipher", url: "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=cipher&backgroundColor=0a0a0a", label: "Cipher" },
  { id: "phantom", url: "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=phantom&backgroundColor=0a0a0a", label: "Phantom" },
  { id: "spectre", url: "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=spectre&backgroundColor=0a0a0a", label: "Spectre" },
  { id: "nomad", url: "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=nomad&backgroundColor=0a0a0a", label: "Nomad" },
];

// Interest tags
const INTEREST_OPTIONS = [
  { id: "gaming", label: "Gaming", icon: "🎮" },
  { id: "sport", label: "Sport", icon: "⚽" },
  { id: "coding", label: "Coding", icon: "💻" },
  { id: "coffee", label: "Coffee", icon: "☕" },
  { id: "music", label: "Music", icon: "🎵" },
  { id: "rpg", label: "RPG", icon: "🎲" },
  { id: "nightlife", label: "Nightlife", icon: "🌙" },
  { id: "fitness", label: "Fitness", icon: "💪" },
  { id: "chess", label: "Chess", icon: "♟️" },
  { id: "running", label: "Running", icon: "🏃" },
  { id: "photography", label: "Photo", icon: "📸" },
  { id: "art", label: "Art", icon: "🎨" },
];

const MAX_TAGS = 5;

const Onboarding = () => {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  
  // Form state
  const [nick, setNick] = useState("");
  const [bio, setBio] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  
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
    { label: "Identity", icon: <User className="w-6 h-6" /> },
    { label: "Base", icon: <MapPin className="w-6 h-6" /> },
  ];

  const toggleTag = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      setSelectedTags(selectedTags.filter((t) => t !== tagId));
    } else if (selectedTags.length < MAX_TAGS) {
      setSelectedTags([...selectedTags, tagId]);
    }
  };

  const handleLocate = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Geolocation Not Supported",
        description: "Your browser doesn't support location services",
        variant: "destructive",
      });
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocating(false);
        toast({
          title: "Coordinates Acquired",
          description: "Base location locked in",
        });
      },
      (error) => {
        setLocating(false);
        toast({
          title: "Location Failed",
          description: error.message || "Could not get your location",
          variant: "destructive",
        });
      },
      { enableHighAccuracy: true }
    );
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
      if (!selectedAvatar) {
        toast({
          title: "Avatar Required",
          description: "Select your operative avatar",
          variant: "destructive",
        });
        return;
      }
      setStep(1);
    }
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
      const avatarUrl = AVATAR_OPTIONS.find((a) => a.id === selectedAvatar)?.url || null;
      const tagLabels = selectedTags.map(
        (id) => INTEREST_OPTIONS.find((t) => t.id === id)?.label || id
      );

      const { error } = await supabase
        .from("profiles")
        .update({
          nick: nick.trim(),
          bio: bio.trim() || null,
          avatar_url: avatarUrl,
          tags: tagLabels,
          base_lat: coords.lat,
          base_lng: coords.lng,
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
        <TacticalCard className="mb-6">
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
                  placeholder="Enter your callsign"
                  maxLength={30}
                  className="bg-muted/50 border-border focus:border-primary font-rajdhani"
                />
              </div>

              {/* Bio */}
              <div className="space-y-2">
                <Label htmlFor="bio" className="font-mono text-xs uppercase text-muted-foreground">
                  Bio ({bio.length}/150)
                </Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value.slice(0, 150))}
                  placeholder="Brief description of your mission objectives..."
                  rows={3}
                  className="bg-muted/50 border-border focus:border-primary font-rajdhani resize-none"
                />
              </div>

              {/* Avatar Selection */}
              <div className="space-y-3">
                <Label className="font-mono text-xs uppercase text-muted-foreground">
                  Select Avatar *
                </Label>
                <AvatarSelector
                  options={AVATAR_OPTIONS}
                  selected={selectedAvatar}
                  onSelect={setSelectedAvatar}
                />
              </div>

              {/* Interest Tags */}
              <div className="space-y-3">
                <Label className="font-mono text-xs uppercase text-muted-foreground">
                  Interests ({selectedTags.length}/{MAX_TAGS})
                </Label>
                <div className="flex flex-wrap gap-2">
                  {INTEREST_OPTIONS.map((interest) => (
                    <InterestChip
                      key={interest.id}
                      label={interest.label}
                      icon={interest.icon}
                      selected={selectedTags.includes(interest.id)}
                      disabled={selectedTags.length >= MAX_TAGS}
                      onClick={() => toggleTag(interest.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6 animate-fade-in-up">
              <div className="flex items-center gap-2 mb-4">
                <Crosshair className="w-5 h-5 text-primary" />
                <h2 className="font-orbitron text-lg font-semibold">Establish Base Coordinates</h2>
              </div>

              {/* Location visualization */}
              <div className="relative bg-muted/30 rounded-lg border border-border p-8 text-center">
                {/* Radar effect */}
                <div className="relative w-40 h-40 mx-auto mb-6">
                  <div className="absolute inset-0 rounded-full border-2 border-primary/30" />
                  <div className="absolute inset-4 rounded-full border border-primary/20" />
                  <div className="absolute inset-8 rounded-full border border-primary/15" />
                  
                  {coords ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-6 h-6 rounded-full bg-success shadow-[0_0_20px_hsl(120_100%_50%)] animate-pulse" />
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-6 h-6 rounded-full bg-muted-foreground/30" />
                    </div>
                  )}
                </div>

                {coords ? (
                  <div className="space-y-2">
                    <div className="font-mono text-sm text-success">
                      ✓ COORDINATES LOCKED
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">
                      LAT: {coords.lat.toFixed(6)} | LNG: {coords.lng.toFixed(6)}
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="neonCyan"
                    size="lg"
                    onClick={handleLocate}
                    disabled={locating}
                    className="mx-auto"
                  >
                    {locating ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Acquiring Signal...
                      </>
                    ) : (
                      <>
                        <Crosshair className="w-5 h-5" />
                        Locate Me
                      </>
                    )}
                  </Button>
                )}
              </div>

              {/* Privacy warning */}
              <div className="flex items-start gap-3 p-4 rounded-lg bg-warning/10 border border-warning/30">
                <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-rajdhani font-semibold text-warning mb-1">
                    Privacy Protocol Active
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">
                    Your exact location is classified. Other operatives will only see you within a 400m radius of this point.
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

          {step === 0 ? (
            <Button variant="solidCyan" onClick={handleNextStep}>
              Continue
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              variant="solidLime"
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
