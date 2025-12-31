import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useActiveArea } from "@/hooks/useActiveArea";
import { supabase } from "@/integrations/supabase/client";
import TacticalMap, { TacticalMapHandle, ViewportBounds } from "@/components/map/TacticalMap";
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const [activeActivities, setActiveActivities] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState<'today' | '3days' | '7days'>('7days');
  const [chatOpenUserId, setChatOpenUserId] = useState<string | null>(null);
  const [chatOpenEventId, setChatOpenEventId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number | null;
    lng: number | null;
    name: string | null;
  }>({ lat: null, lng: null, name: null });
  const [guestLocation, setGuestLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [viewportBounds, setViewportBounds] = useState<ViewportBounds | null>(null);
  const mapRef = useRef<TacticalMapHandle | null>(null);
  const deepLinkHandledRef = useRef(false);

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

  // Handle deep link for eventId parameter
  useEffect(() => {
    const eventId = searchParams.get('eventId');
    
    // Skip if no eventId, already handled, or map not ready
    if (!eventId || deepLinkHandledRef.current || !mapRef.current) return;
    
    deepLinkHandledRef.current = true;
    
    const handleDeepLink = async () => {
      try {
        // Fetch the spot data
        const { data, error } = await supabase
          .from('megaphones')
          .select('id, lat, lng, title')
          .eq('id', eventId)
          .maybeSingle();
        
        if (error || !data) {
          toast({
            title: 'Spot not found',
            description: 'The spot you were looking for no longer exists.',
            variant: 'destructive',
          });
          // Clear the eventId param
          setSearchParams({}, { replace: true });
          return;
        }
        
        // Fly camera to spot location (without moving user avatar)
        mapRef.current?.flyTo(data.lat, data.lng);
        
        // Open the spot details modal
        mapRef.current?.openMissionById(data.id);
        
        // Clear the eventId param after handling
        setSearchParams({}, { replace: true });
      } catch (err) {
        console.error('Error handling deep link:', err);
        toast({
          title: 'Spot not found',
          description: 'Unable to load the spot details.',
          variant: 'destructive',
        });
        setSearchParams({}, { replace: true });
      }
    };
    
    handleDeepLink();
  }, [searchParams, setSearchParams, toast]);

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
      setChatOpenEventId(null);
    }
  };

  const handleCloseChat = () => {
    setChatOpenUserId(null);
    setChatOpenEventId(null);
  };

  const handleOpenSpotChat = (eventId: string) => {
    setChatOpenEventId(eventId);
    setChatOpenUserId(null);
  };

  const handleLocationUpdated = async (lat: number, lng: number, name?: string) => {
    setCurrentLocation({ lat, lng, name: name ?? null });
    // Fly to new location
    mapRef.current?.flyTo(lat, lng);
    // Refresh profile to get updated data
    await refreshProfile();
  };

  // Handler for context menu teleport (no name provided)
  const handleMapLocationUpdated = (lat: number, lng: number) => {
    handleLocationUpdated(lat, lng);
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

  const handleViewportChange = (bounds: ViewportBounds) => {
    setViewportBounds(bounds);
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
    <div className="fixed inset-0 h-dvh overflow-hidden bg-background">
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
          onGhostModeChange={(isGhost) => handleActiveChange(!isGhost)}
          isGuest={isGuest}
          onOpenChatWithUser={handleOpenChatWithUser}
          onOpenSpotChat={handleOpenSpotChat}
          onCloseChat={handleCloseChat}
          onLocationUpdated={handleMapLocationUpdated}
          onViewportChange={handleViewportChange}
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
          onSignOut={handleSignOut}
          onMissionCreated={handleMissionCreated}
          onOpenMission={handleOpenMission}
          chatOpenUserId={chatOpenUserId}
          chatOpenEventId={chatOpenEventId}
          onChatOpenChange={handleChatOpenChange}
          onFlyTo={handleFlyTo}
          onLocationUpdated={handleLocationUpdated}
          viewportBounds={viewportBounds}
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

      {/* Status indicator - z-30 floating bottom left with safe area - Only show for guests */}
      {isGuest && (
        <div className="fixed left-4 z-30 safe-area-left" style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card/95 backdrop-blur-md border-2 border-border shadow-hard">
            <div className="w-2 h-2 rounded-full bg-muted-foreground animate-pulse" />
            <span className="font-nunito text-xs font-medium text-foreground/80 hidden sm:block">
              Guest Mode
            </span>
            <span className="font-nunito text-xs font-medium text-foreground/80 sm:hidden">
              Guest
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
