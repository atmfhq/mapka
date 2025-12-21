import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import TacticalCard from "@/components/TacticalCard";
import InterestChip from "@/components/InterestChip";
import AvatarSelector from "@/components/AvatarSelector";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  ChevronLeft,
  Loader2,
  Save,
  Target,
  Shield
} from "lucide-react";

// Preset avatars - cyberpunk/tactical themed
const AVATAR_OPTIONS = [
  { id: "ghost", url: "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=ghost&backgroundColor=0a0a0a", label: "Ghost" },
  { id: "cipher", url: "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=cipher&backgroundColor=0a0a0a", label: "Cipher" },
  { id: "phantom", url: "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=phantom&backgroundColor=0a0a0a", label: "Phantom" },
  { id: "spectre", url: "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=spectre&backgroundColor=0a0a0a", label: "Spectre" },
  { id: "nomad", url: "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=nomad&backgroundColor=0a0a0a", label: "Nomad" },
];

// Interest tags (will be replaced with activities.ts in future)
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

const EditProfile = () => {
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  
  // Form state
  const [nick, setNick] = useState("");
  const [bio, setBio] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Populate form with existing profile data
  useEffect(() => {
    if (profile) {
      setNick(profile.nick || "");
      setBio(profile.bio || "");
      
      // Find avatar by URL
      const avatarOption = AVATAR_OPTIONS.find(a => a.url === profile.avatar_url);
      setSelectedAvatar(avatarOption?.id || null);
      
      // Map tag labels back to IDs
      const tagIds = (profile.tags || []).map(label => {
        const option = INTEREST_OPTIONS.find(o => o.label === label);
        return option?.id || label;
      }).filter(id => INTEREST_OPTIONS.some(o => o.id === id));
      setSelectedTags(tagIds);
      
      setInitialLoading(false);
    }
  }, [profile]);

  const toggleTag = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      setSelectedTags(selectedTags.filter((t) => t !== tagId));
    } else if (selectedTags.length < MAX_TAGS) {
      setSelectedTags([...selectedTags, tagId]);
    }
  };

  const handleSubmit = async () => {
    if (!nick.trim()) {
      toast({
        title: "Nickname Required",
        description: "Every operative needs a callsign",
        variant: "destructive",
      });
      return;
    }

    if (!user) return;

    setLoading(true);
    try {
      const avatarUrl = AVATAR_OPTIONS.find((a) => a.id === selectedAvatar)?.url || profile?.avatar_url || null;
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
        })
        .eq("id", user.id);

      if (error) throw error;

      await refreshProfile();
      
      toast({
        title: "Profile Updated",
        description: "Your changes have been saved",
      });
      
      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.message || "Could not save profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-background tactical-grid flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

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
            Edit <span className="text-primary">Profile</span>
          </h1>
          <p className="font-mono text-sm text-muted-foreground">
            Update your operative profile
          </p>
        </div>

        {/* Edit Form */}
        <TacticalCard className="mb-6">
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
                Select Avatar
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
        </TacticalCard>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ChevronLeft className="w-4 h-4" />
            Back to Map
          </Button>

          <Button
            variant="solidCyan"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EditProfile;
