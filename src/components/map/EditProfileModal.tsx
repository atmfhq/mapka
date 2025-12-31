import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import AvatarBuilder from "@/components/avatar/AvatarBuilder";
import AvatarDisplay from "@/components/avatar/AvatarDisplay";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Json } from "@/integrations/supabase/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  X,
  Loader2,
  Save,
  Shield,
  Sparkles,
  AlertTriangle,
  LogOut
} from "lucide-react";
import { getShortUserId } from "@/utils/userIdDisplay";
import InstallPrompt from "@/components/InstallPrompt";

interface AvatarConfig {
  skinColor?: string;
  shape?: string;
  eyes?: string;
  mouth?: string;
}

interface EditProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignOut: () => void;
}

const EditProfileModal = ({ open, onOpenChange, onSignOut }: EditProfileModalProps) => {
  const [loading, setLoading] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [activeTab, setActiveTab] = useState("identity");
  
  // Form state
  const [nick, setNick] = useState("");
  const [bio, setBio] = useState("");
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>({
    skinColor: "cyan",
    shape: "circle",
    eyes: "normal",
    mouth: "smile",
  });
  
  const { user, profile, refreshProfile, signOut } = useAuth();
  const { toast } = useToast();

  // Populate form with existing profile data
  useEffect(() => {
    if (profile && open) {
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
    }
  }, [profile, open]);

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
      const { error } = await supabase
        .from("profiles")
        .update({
          nick: nick.trim(),
          bio: bio.trim() || null,
          avatar_config: avatarConfig as Json,
        })
        .eq("id", user.id);

      if (error) throw error;

      await refreshProfile();
      
      toast({
        title: "Profile Updated",
        description: "Your changes have been saved",
      });
      
      onOpenChange(false);
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
      const { error } = await supabase.rpc('delete_user_account');
      
      if (error) throw error;
      
      await signOut();
      
      toast({
        title: "Account Deleted",
        description: "Your account and all data have been permanently removed.",
      });
      
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
    }
  };

  const handleSignOutClick = () => {
    onOpenChange(false);
    onSignOut();
  };

  if (!open) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ isolation: 'isolate' }}>
      {/* Backdrop - Light blue overlay matching Connections modal */}
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      
      {/* Modal - Standard card style matching Connections modal */}
      <div className="relative bg-card border-2 border-border rounded-2xl shadow-hard w-full max-w-md max-h-[85vh] flex flex-col animate-in zoom-in-95 fade-in duration-200 z-10">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <AvatarDisplay config={avatarConfig} size={40} showGlow={false} />
            <div>
              <h3 className="font-nunito font-bold text-foreground">{nick || "My Profile"}</h3>
              <p className="text-xs text-muted-foreground">Edit your profile</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="rounded-lg hover:bg-muted"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-2 w-full bg-muted/50 mb-4">
              <TabsTrigger value="identity" className="gap-1.5 text-xs">
                <Shield className="w-4 h-4" />
                <span className="hidden sm:inline">Identity</span>
              </TabsTrigger>
              <TabsTrigger value="appearance" className="gap-1.5 text-xs">
                <Sparkles className="w-4 h-4" />
                <span className="hidden sm:inline">Avatar</span>
              </TabsTrigger>
            </TabsList>

            {/* Identity Tab */}
            <TabsContent value="identity" className="space-y-4 animate-fade-in">
              {/* User ID Display */}
              {user && (
                <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-xl border border-border/50">
                  <span className="font-nunito text-sm text-muted-foreground">Your ID:</span>
                  <span className="font-mono text-sm font-bold text-primary">{getShortUserId(user.id)}</span>
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

              {/* Actions */}
              <div className="space-y-2 pt-2">
                <InstallPrompt />
                
                <Button
                  onClick={handleSignOutClick}
                  variant="outline"
                  className="w-full justify-start gap-3 border-destructive/30 text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="font-medium">Sign Out</span>
                </Button>
              </div>

              {/* Delete Account */}
              <div className="text-center pt-2 border-t border-border/30">
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
            </TabsContent>


            {/* Appearance Tab */}
            <TabsContent value="appearance" className="animate-fade-in max-h-[40vh] overflow-y-auto">
              <AvatarBuilder 
                initialConfig={avatarConfig}
                onChange={setAvatarConfig}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-border shrink-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="bg-background border-2 border-destructive/30">
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
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default EditProfileModal;
