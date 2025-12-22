import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import TacticalCard from "@/components/TacticalCard";
import InterestSelector from "@/components/InterestSelector";
import AvatarBuilder from "@/components/avatar/AvatarBuilder";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ACTIVITIES } from "@/constants/activities";
import type { Json } from "@/integrations/supabase/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  ChevronLeft,
  Loader2,
  Save,
  Target,
  Shield,
  Heart,
  Sparkles,
  Trash2,
  AlertTriangle
} from "lucide-react";

interface AvatarConfig {
  skinColor?: string;
  shape?: string;
  eyes?: string;
  mouth?: string;
}

const EditProfile = () => {
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [deletingAccount, setDeletingAccount] = useState(false);
  
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
  
  const { user, profile, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Populate form with existing profile data
  useEffect(() => {
    if (profile) {
      setNick(profile.nick || "");
      setBio(profile.bio || "");
      
      // Load avatar config
      if (profile.avatar_config) {
        setAvatarConfig({
          skinColor: profile.avatar_config.skinColor || "cyan",
          shape: profile.avatar_config.shape || "circle",
          eyes: profile.avatar_config.eyes || "normal",
          mouth: profile.avatar_config.mouth || "smile",
        });
      }
      
      // Map tag labels back to IDs
      const tagIds = (profile.tags || []).map(label => {
        const activity = ACTIVITIES.find(a => a.label === label);
        return activity?.id || null;
      }).filter((id): id is string => id !== null);
      setSelectedTags(tagIds);
      
      setInitialLoading(false);
    }
  }, [profile]);

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
      // Map activity IDs to labels
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

  const handleDeleteAccount = async () => {
    if (!user) return;
    
    setDeletingAccount(true);
    try {
      // Call the security definer RPC function to delete the account
      // This handles deletion from auth.users and all related tables
      const { error } = await supabase.rpc('delete_user_account');
      
      if (error) throw error;
      
      // Clear local session
      await signOut();
      
      toast({
        title: "Account Deleted",
        description: "Your account and all data have been permanently removed.",
      });
      
      navigate("/");
    } catch (error: any) {
      console.error('Account deletion failed:', error);
      toast({
        title: "Deletion Failed",
        description: error.message || "Could not delete account. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeletingAccount(false);
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

        {/* Edit Form with Tabs */}
        <TacticalCard className="mb-6">
          <Tabs defaultValue="identity" className="w-full">
            <TabsList className="grid grid-cols-3 w-full bg-muted/50 mb-6">
              <TabsTrigger value="identity" className="gap-1.5 text-xs">
                <Shield className="w-4 h-4" />
                <span className="hidden sm:inline">Identity</span>
              </TabsTrigger>
              <TabsTrigger value="interests" className="gap-1.5 text-xs">
                <Heart className="w-4 h-4" />
                <span className="hidden sm:inline">Interests</span>
              </TabsTrigger>
              <TabsTrigger value="appearance" className="gap-1.5 text-xs">
                <Sparkles className="w-4 h-4" />
                <span className="hidden sm:inline">Avatar</span>
              </TabsTrigger>
            </TabsList>

            {/* Identity Tab */}
            <TabsContent value="identity" className="space-y-6 animate-fade-in-up">
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
            </TabsContent>

            {/* Interests Tab */}
            <TabsContent value="interests" className="animate-fade-in-up max-h-[50vh] overflow-y-auto">
              <InterestSelector 
                selected={selectedTags}
                onChange={setSelectedTags}
              />
            </TabsContent>

            {/* Appearance Tab */}
            <TabsContent value="appearance" className="animate-fade-in-up max-h-[50vh] overflow-y-auto">
              <AvatarBuilder 
                initialConfig={avatarConfig}
                onChange={setAvatarConfig}
              />
            </TabsContent>
          </Tabs>
        </TacticalCard>

        {/* Danger Zone */}
        <TacticalCard className="mb-6 border-destructive/30 bg-destructive/5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <h3 className="font-orbitron text-sm font-semibold text-destructive">
              DANGER ZONE
            </h3>
          </div>
          
          <p className="text-sm text-muted-foreground mb-4">
            Once you delete your account, there is no going back. All your data, connections, and events will be permanently removed.
          </p>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="destructive" 
                className="w-full"
                disabled={deletingAccount}
              >
                {deletingAccount ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Account
                  </>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-card border-destructive/30">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-orbitron flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  Delete Account Permanently?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete your account, profile, all connections, events you've hosted, and remove all your data from our servers.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Yes, Delete My Account
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TacticalCard>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ChevronLeft className="w-4 h-4" />
            Back to Map
          </Button>

          <Button
            variant="default"
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
