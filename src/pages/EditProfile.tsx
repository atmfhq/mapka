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
import { useKeyboardAvoidance } from "@/hooks/useKeyboardAvoidance";
import { ACTIVITIES } from "@/constants/activities";
import type { Json } from "@/integrations/supabase/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  ChevronLeft,
  Loader2,
  Save,
  Target,
  Shield,
  Heart,
  Sparkles,
  Settings,
  AlertTriangle
} from "lucide-react";
import { getShortUserId } from "@/utils/userIdDisplay";

interface AvatarConfig {
  skinColor?: string;
  shape?: string;
  eyes?: string;
  mouth?: string;
}

interface NotificationPreferences {
  new_comments: boolean;
  event_updates: boolean;
  event_reminders: boolean;
}

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  new_comments: true,
  event_updates: true,
  event_reminders: true,
};

function normalizeNotificationPreferences(value: unknown): NotificationPreferences {
  const v = (value && typeof value === "object") ? (value as any) : {};
  return {
    new_comments: typeof v.new_comments === "boolean" ? v.new_comments : DEFAULT_NOTIFICATION_PREFERENCES.new_comments,
    event_updates: typeof v.event_updates === "boolean" ? v.event_updates : DEFAULT_NOTIFICATION_PREFERENCES.event_updates,
    event_reminders: typeof v.event_reminders === "boolean" ? v.event_reminders : DEFAULT_NOTIFICATION_PREFERENCES.event_reminders,
  };
}

const EditProfile = () => {
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [activeTab, setActiveTab] = useState("identity");
  
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
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES
  );
  
  const { user, profile, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const keyboardRef = useKeyboardAvoidance();

  // Populate form with existing profile data
  useEffect(() => {
    if (profile) {
      setNick(profile.nick || "");
      setBio(profile.bio || "");
      setNotificationPreferences(normalizeNotificationPreferences((profile as any).notification_preferences));
      
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
          notification_preferences: notificationPreferences as unknown as Json,
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div ref={keyboardRef} className="min-h-dvh bg-background overflow-y-auto">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 pointer-events-none" />
      
      <div className="relative z-10 w-full max-w-2xl mx-auto p-4 py-8 pb-safe">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/20 border-2 border-primary/40 flex items-center justify-center shadow-hard-sm">
              <Target className="w-6 h-6 text-primary" />
            </div>
          </div>
          <h1 className="font-fredoka text-2xl font-bold mb-2">
            Edit <span className="text-primary">Profile</span>
          </h1>
          <p className="font-nunito text-sm text-muted-foreground">
            Update your adventurer profile
          </p>
        </div>

        {/* Edit Form with Tabs */}
        <TacticalCard className="mb-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-4 w-full bg-muted/50 mb-6">
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
              <TabsTrigger value="settings" className="gap-1.5 text-xs">
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Settings</span>
              </TabsTrigger>
            </TabsList>

            {/* Identity Tab */}
            <TabsContent value="identity" className="space-y-6 animate-fade-in-up">
              {/* User ID Display */}
              {user && (
                <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-xl border border-border/50">
                  <span className="font-nunito text-sm text-muted-foreground">Your ID:</span>
                  <span className="font-mono text-sm font-bold text-primary">{getShortUserId(user.id)}</span>
                  <span className="text-xs text-muted-foreground/70">(unique identifier)</span>
                </div>
              )}

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
                  className="bg-muted/50 border-2 border-border focus:border-primary rounded-xl font-nunito"
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
                  className="bg-muted/50 border-2 border-border focus:border-primary rounded-xl font-nunito resize-none"
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
                showPreviewLabel={false}
              />
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-6 animate-fade-in-up">
              <div className="space-y-2">
                <h3 className="font-fredoka text-lg font-bold">Email Notifications</h3>
                <p className="font-nunito text-sm text-muted-foreground">
                  Control which emails you receive.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4 p-4 bg-muted/30 rounded-xl border border-border/50">
                  <div className="space-y-1">
                    <Label className="font-nunito text-sm font-medium text-foreground">New Comments</Label>
                    <p className="text-xs text-muted-foreground">
                      New comments on your shouts and events.
                    </p>
                  </div>
                  <Switch
                    checked={notificationPreferences.new_comments}
                    onCheckedChange={(checked) =>
                      setNotificationPreferences((prev) => ({ ...prev, new_comments: checked }))
                    }
                  />
                </div>

                <div className="flex items-start justify-between gap-4 p-4 bg-muted/30 rounded-xl border border-border/50">
                  <div className="space-y-1">
                    <Label className="font-nunito text-sm font-medium text-foreground">Event Updates</Label>
                    <p className="text-xs text-muted-foreground">
                      Changes to events you joined.
                    </p>
                  </div>
                  <Switch
                    checked={notificationPreferences.event_updates}
                    onCheckedChange={(checked) =>
                      setNotificationPreferences((prev) => ({ ...prev, event_updates: checked }))
                    }
                  />
                </div>

                <div className="flex items-start justify-between gap-4 p-4 bg-muted/30 rounded-xl border border-border/50">
                  <div className="space-y-1">
                    <Label className="font-nunito text-sm font-medium text-foreground">Event Reminders</Label>
                    <p className="text-xs text-muted-foreground">
                      Reminders 1h before start.
                    </p>
                  </div>
                  <Switch
                    checked={notificationPreferences.event_reminders}
                    onCheckedChange={(checked) =>
                      setNotificationPreferences((prev) => ({ ...prev, event_reminders: checked }))
                    }
                  />
                </div>
              </div>

              {/* Delete Account (bottom of Settings) */}
              <div className="pt-4 border-t border-border/30">
                <div className="text-center">
                  <button
                    onClick={() => {
                      setDeleteConfirmText("");
                      setDeleteConfirmOpen(true);
                    }}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors underline-offset-2 hover:underline"
                    disabled={deletingAccount}
                  >
                    {deletingAccount ? "Deleting..." : "Delete my account"}
                  </button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </TacticalCard>

        {/* Navigation */}
        <div className="flex justify-between mb-6">
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

        {/* Delete Confirmation Dialog */}
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
              <AlertDialogCancel onClick={() => setDeleteConfirmText("")}>
                Cancel
              </AlertDialogCancel>
              <Button
                variant="destructive"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  handleDeleteAccount();
                }}
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

        {/* Bottom breathing room */}
        <div className="h-8" />
      </div>
    </div>
  );
};

export default EditProfile;
