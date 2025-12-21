import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import TacticalMap, { TacticalMapHandle } from "@/components/map/TacticalMap";
import Navbar from "@/components/map/Navbar";
import MapFilterHUD from "@/components/map/MapFilterHUD";
import RelocateModal from "@/components/map/RelocateModal";
import LoadingScreen from "@/components/LoadingScreen";
import { getActivityById } from "@/constants/activities";

interface AvatarConfig {
  skinColor?: string;
  shape?: string;
  eyes?: string;
  mouth?: string;
}

const Dashboard = () => {
  const { user, profile, loading, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [activeActivity, setActiveActivity] = useState<string | null>(null);
  const [chatOpenUserId, setChatOpenUserId] = useState<string | null>(null);
  const [relocateModalOpen, setRelocateModalOpen] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number | null;
    lng: number | null;
    name: string | null;
  }>({ lat: null, lng: null, name: null });
  const mapRef = useRef<TacticalMapHandle | null>(null);

  // Initialize location from profile
  useEffect(() => {
    if (profile) {
      setCurrentLocation({
        lat: profile.location_lat ?? profile.base_lat ?? null,
        lng: profile.location_lng ?? profile.base_lng ?? null,
        name: profile.location_name ?? null,
      });
    }
  }, [profile]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
    if (!loading && profile && !profile.is_onboarded) {
      navigate("/onboarding");
    }
  }, [loading, user, profile, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleActivityChange = (activity: string | null) => {
    setActiveActivity(activity);
  };

  const handleMissionCreated = () => {
    mapRef.current?.fetchMegaphones();
  };

  const handleOpenMission = (missionId: string) => {
    mapRef.current?.openMissionById(missionId);
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

  if (loading || !profile) {
    return <LoadingScreen />;
  }

  // Use location_lat/lng if available, otherwise fall back to base_lat/lng
  const userLat = currentLocation.lat ?? profile.base_lat ?? 40.7128;
  const userLng = currentLocation.lng ?? profile.base_lng ?? -74.006;

  const activeActivityData = activeActivity ? getActivityById(activeActivity) : null;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      {/* Map Layer */}
      <TacticalMap 
        ref={mapRef}
        userLat={userLat}
        userLng={userLng}
        currentUserId={user!.id}
        activeActivity={activeActivity}
        currentUserAvatarConfig={profile.avatar_config as AvatarConfig | null}
        locationLat={currentLocation.lat}
        locationLng={currentLocation.lng}
        onOpenChatWithUser={handleOpenChatWithUser}
        onCloseChat={handleCloseChat}
      />

      {/* Navbar - App Navigation */}
      <Navbar
        nick={profile.nick || "Operative"}
        avatarUrl={profile.avatar_url}
        currentUserId={user!.id}
        onSignOut={handleSignOut}
        onMissionCreated={handleMissionCreated}
        onOpenMission={handleOpenMission}
        chatOpenUserId={chatOpenUserId}
        onChatOpenChange={handleChatOpenChange}
        onRelocateClick={() => setRelocateModalOpen(true)}
      />

      {/* Map Filter HUD - Floating below navbar */}
      <MapFilterHUD
        activeActivity={activeActivity}
        onActivityChange={handleActivityChange}
      />

      {/* Relocate Modal */}
      <RelocateModal
        open={relocateModalOpen}
        onOpenChange={setRelocateModalOpen}
        currentUserId={user!.id}
        currentLocationName={currentLocation.name ?? undefined}
        onLocationUpdated={handleLocationUpdated}
      />

      {/* Filter active indicator - positioned below filter HUD */}
      {activeActivityData && (
        <div className="absolute top-[140px] md:top-[130px] left-1/2 -translate-x-1/2 z-20">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/20 border border-primary/40 backdrop-blur-sm">
            <span className="text-sm">{activeActivityData.icon}</span>
            <span className="font-rajdhani text-xs text-primary font-medium">
              Filtering: {activeActivityData.label}
            </span>
          </div>
        </div>
      )}

      {/* Status indicator - positioned for mobile safe area */}
      <div className="absolute bottom-4 left-4 z-20 safe-area-bottom safe-area-left">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card/80 backdrop-blur-md border border-border/50">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse shadow-[0_0_8px_hsl(var(--success))]" />
          <span className="font-mono text-xs text-muted-foreground hidden sm:block">
            TACTICAL OVERLAY ACTIVE
          </span>
          <span className="font-mono text-xs text-muted-foreground sm:hidden">
            ONLINE
          </span>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
