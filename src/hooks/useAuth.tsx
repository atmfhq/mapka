import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

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

interface Profile {
  id: string;
  nick: string | null;
  bio: string | null;
  avatar_url: string | null;
  avatar_config: AvatarConfig | null;
  notification_preferences: NotificationPreferences | null;
  tags: string[] | null;
  location_lat: number | null;
  location_lng: number | null;
  location_name: string | null;
  is_onboarded: boolean | null;
  is_18_plus: boolean;
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  markOnline: () => Promise<void>;
  markOffline: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching profile:", error);
      return null;
    }
    
    if (!data) return null;
    
    // Cast the data to Profile, handling avatar_config type
    return {
      id: data.id,
      nick: data.nick,
      bio: data.bio,
      avatar_url: data.avatar_url,
      avatar_config: data.avatar_config as AvatarConfig | null,
      notification_preferences: data.notification_preferences as unknown as NotificationPreferences | null,
      tags: data.tags,
      location_lat: data.location_lat,
      location_lng: data.location_lng,
      location_name: data.location_name,
      is_onboarded: data.is_onboarded,
      is_18_plus: data.is_18_plus ?? false,
      is_active: data.is_active ?? true,
    };
  };

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
    }
  };

  // Mark user as online in the database
  const markOnline = useCallback(async () => {
    const userId = user?.id;
    if (!userId) return;

    try {
      const { error } = await supabase.rpc('mark_user_online', { p_user_id: userId });
      if (error) {
        console.warn('[Auth] Could not mark user online:', error.message);
      } else {
        console.log('[Auth] Marked user online:', userId);
      }
    } catch (err) {
      console.error('[Auth] Error marking user online:', err);
    }
  }, [user?.id]);

  // Mark user as offline in the database
  const markOffline = useCallback(async () => {
    const userId = user?.id;
    if (!userId) return;

    try {
      const { error } = await supabase.rpc('mark_user_offline', { p_user_id: userId });
      if (error) {
        console.warn('[Auth] Could not mark user offline:', error.message);
      } else {
        console.log('[Auth] Marked user offline:', userId);
      }
    } catch (err) {
      console.error('[Auth] Error marking user offline:', err);
    }
  }, [user?.id]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("[Auth] Event:", event, "Session:", !!session);
        
        // Handle different auth events appropriately
        if (event === 'TOKEN_REFRESHED') {
          // Token was refreshed - just update state, don't sign out
          console.log("[Auth] Token refreshed successfully");
          setSession(session);
          setUser(session?.user ?? null);
          return;
        }
        
        if (event === 'SIGNED_OUT') {
          // User explicitly signed out
          setSession(null);
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }
        
        // For SIGNED_IN, INITIAL_SESSION, USER_UPDATED events
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer profile fetch to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id)
              .then(setProfile)
              .catch((err) => console.error('[Auth] Error fetching profile:', err));
          }, 0);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    // Aggressively try to restore session on mount
    const restoreSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("[Auth] Error restoring session:", error);
          setLoading(false);
          return;
        }
        
        console.log("[Auth] Session restored:", !!session);
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          const profileData = await fetchProfile(session.user.id);
          setProfile(profileData);
        }
        setLoading(false);
      } catch (err) {
        console.error("[Auth] Unexpected error restoring session:", err);
        setLoading(false);
      }
    };
    
    restoreSession();

    return () => subscription.unsubscribe();
  }, []);

  // Handle tab visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        console.log('[Auth] Tab hidden, heartbeat will stop and cleanup will mark offline');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const signOut = async () => {
    // Mark user offline before signing out
    if (user?.id) {
      try {
        const { error } = await supabase.rpc('mark_user_offline', { p_user_id: user.id });
        if (!error) {
          console.log('[Auth] Marked user offline before signout');
        }
      } catch (err) {
        // Ignore errors - we're signing out anyway
      }
    }

    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signOut, refreshProfile, markOnline, markOffline }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
