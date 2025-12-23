import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useActiveArea } from "@/hooks/useActiveArea";
import { supabase } from "@/integrations/supabase/client";
import TacticalMap, { TacticalMapHandle } from "@/components/map/TacticalMap";
import Navbar from "@/components/map/Navbar";
import GuestNavbar from "@/components/map/GuestNavbar";
import MapFilterHUD from "@/components/map/MapFilterHUD";
import LoadingScreen from "@/components/LoadingScreen";
import { useToast } from "@/hooks/use-toast";

interface AvatarConfig {
  skinColor?: string;
  shape?: string;
  eyes?: string;
  mouth?: string;
}

const Dashboard = () => {
  const { user, profile, loading, signOut, refreshProfile } = useAuth();
  const { lat: activeAreaLat, lng: activeAreaLng, loading: activeAreaLoading } = useActiveArea();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeActivities, setActiveActivities] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState<'today' | '3days' | '7days'>('7days');
  const [chatOpenUserId, setChatOpenUserId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number | null;
    lng: number | null;
    name: string | null;
  }>({ lat: null, lng: null, name: null });
  const [guestLocation, setGuestLocation] = useState<{ lat: number; lng: number } | null>(null);
  const mapRef = useRef<TacticalMapHandle | null>(null);

  const isGuest = !user;

  // Set guest location once active area is loaded
  useEffect(() => {
    if (isGuest && !activeAreaLoading && !guestLocation) {
      setGuestLocation({ lat: activeAreaLat, lng: activeAreaLng });
    }
  }, [isGuest, activeAreaLoading, activeAreaLat, activeAreaLng, guestLocation]);

  // Initialize location and active status from profile (for logged-in users)
  useEffect(() => {
    if (profile) {
      setCurrentLocation({
        lat: profile.location_lat ?? null,
        lng: profile.location_lng ?? null,
        name: profile.location_name ?? null,
      });
      setIsActive(profile.is_active ?? true);
    }
  }, [profile]);

  // Redirect logged-in but not onboarded users to onboarding
  useEffect(() => {
    if (!loading && user && profile && !profile.is_onboarded) {
      navigate("/onboarding");
    }
  }, [loading, user, profile, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleActivityToggle = (activity: string) => {
    setActiveActivities(prev => 
      prev.includes(activity)
        ? prev.filter(a => a !== activity)
        : [...prev, activity]
    );
  };

  const handleClearFilters = () => {
    setActiveActivities([]);
  };

  const handleMissionCreated = () => {
    mapRef.current?.fetchQuests();
  };

  const handleOpenMission = (missionId: string) => {
    mapRef.current?.openMissionById(missionId);
  };

  const handleFlyToQuest = (lat: number, lng: number) => {
    mapRef.current?.flyTo(lat, lng);
  };

  const handleOpenChatWithUser = (userId: string) => {
    console.log('Dashboard: Opening chat with user:', userId);
    setChatOpenUserId(userId);
  };

  const handleChatOpenChange = (open: boolean) => {
    if (!open) {
      setChatOpenUserId(null);
    }
  };

  const handleCloseChat = () => {
    setChatOpenUserId(null);
  };

  const handleLocationUpdated = async (lat: number, lng: number, name: string) => {
    setCurrentLocation({ lat, lng, name });
    // Fly to new location
    mapRef.current?.flyTo(lat, lng);
    // Refresh profile to get updated data
    await refreshProfile();
  };

  const handleActiveChange = async (active: boolean) => {
    if (!user) return;
    
    setIsActive(active);
    
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: active })
      .eq('id', user.id);
    
    if (error) {
      console.error('Failed to update active status:', error);
      setIsActive(!active); // Revert on error
      toast({
        title: 'Failed to update visibility',
        description: 'Please try again',
        variant: 'destructive',
      });
    } else {
      toast({
        title: active ? 'You are now visible' : 'Ghost Mode activated',
        description: active ? 'Others can see you on the map' : 'You are hidden from others',
      });
    }
  };

  const handleFlyTo = (lat: number, lng: number) => {
    if (isGuest) {
      setGuestLocation({ lat, lng });
    }
    mapRef.current?.flyTo(lat, lng);
  };

  // Show loading for guests waiting for active area, or logged-in users waiting for profile
  if (loading || (isGuest && activeAreaLoading)) {
    return <LoadingScreen />;
  }

  // For logged-in users, wait for profile
  if (user && !profile) {
    return <LoadingScreen />;
  }

  // Determine map center - use active area for guests until they search
  const guestLat = guestLocation?.lat ?? activeAreaLat;
  const guestLng = guestLocation?.lng ?? activeAreaLng;
  const mapLat = isGuest ? guestLat : (currentLocation.lat ?? profile?.location_lat ?? activeAreaLat);
  const mapLng = isGuest ? guestLng : (currentLocation.lng ?? profile?.location_lng ?? activeAreaLng);

  return (
    <div className="fixed inset-0 overflow-hidden bg-background">
      {/* Map Layer - z-0 base layer */}
      <div className="absolute inset-0 z-0">
        <TacticalMap 
          ref={mapRef}
          userLat={mapLat}
          userLng={mapLng}
          baseLat={mapLat}
          baseLng={mapLng}
          currentUserId={user?.id ?? null}
          activeActivities={activeActivities}
          dateFilter={dateFilter}
          currentUserAvatarConfig={profile?.avatar_config as AvatarConfig | null}
          locationLat={isGuest ? guestLat : currentLocation.lat}
          locationLng={isGuest ? guestLng : currentLocation.lng}
          isGhostMode={isGuest || !isActive}
          isGuest={isGuest}
          onOpenChatWithUser={handleOpenChatWithUser}
          onCloseChat={handleCloseChat}
        />
      </div>

      {/* Navbar - z-50 floating above everything */}
      {isGuest ? (
        <GuestNavbar onFlyTo={handleFlyTo} />
      ) : (
        <Navbar
          nick={profile?.nick || "Adventurer"}
          avatarUrl={profile?.avatar_url ?? null}
          avatarConfig={profile?.avatar_config as AvatarConfig | null}
          currentUserId={user.id}
          isActive={isActive}
          onActiveChange={handleActiveChange}
          onSignOut={handleSignOut}
          onMissionCreated={handleMissionCreated}
          onOpenMission={handleOpenMission}
          onFlyToQuest={handleFlyToQuest}
          chatOpenUserId={chatOpenUserId}
          onChatOpenChange={handleChatOpenChange}
          onFlyTo={handleFlyTo}
          onLocationUpdated={handleLocationUpdated}
        />
      )}

      {/* Map Filter HUD - z-40 below navbar */}
      <MapFilterHUD
        activeActivities={activeActivities}
        onActivityToggle={handleActivityToggle}
        onClearFilters={handleClearFilters}
        dateFilter={dateFilter}
        onDateFilterChange={setDateFilter}
      />

      {/* Status indicator - z-30 floating bottom left */}
      <div className="fixed bottom-4 left-4 z-30 safe-area-bottom safe-area-left">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card/95 backdrop-blur-md border-2 border-border shadow-hard">
          <div className={`w-2 h-2 rounded-full ${isGuest ? 'bg-muted-foreground' : 'bg-success'} animate-pulse`} />
          <span className="font-nunito text-xs font-medium text-foreground/80 hidden sm:block">
            {isGuest ? 'Guest Mode' : 'Adventure Mode'}
          </span>
          <span className="font-nunito text-xs font-medium text-foreground/80 sm:hidden">
            {isGuest ? 'Guest' : 'Online'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
