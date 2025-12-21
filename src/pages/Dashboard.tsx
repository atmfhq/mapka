import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import TacticalMap from "@/components/map/TacticalMap";
import MapHUD from "@/components/map/MapHUD";
import LoadingScreen from "@/components/LoadingScreen";

const Dashboard = () => {
  const { user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const mapRef = useRef<{ fetchMegaphones: () => void; openMissionById: (id: string) => void } | null>(null);

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

  const handleToggleFilter = (categoryId: string) => {
    setActiveFilters(prev => 
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleMissionCreated = () => {
    mapRef.current?.fetchMegaphones();
  };

  const handleOpenMission = (missionId: string) => {
    mapRef.current?.openMissionById(missionId);
  };

  if (loading || !profile) {
    return <LoadingScreen />;
  }

  // Default to a central location if user hasn't set base
  const userLat = profile.base_lat || 40.7128;
  const userLng = profile.base_lng || -74.006;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      {/* Map Layer */}
      <TacticalMap 
        ref={mapRef}
        userLat={userLat}
        userLng={userLng}
        currentUserId={user!.id}
      />

      {/* HUD Overlay */}
      <MapHUD
        nick={profile.nick || "Operative"}
        avatarUrl={profile.avatar_url}
        activeFilters={activeFilters}
        currentUserId={user!.id}
        onToggleFilter={handleToggleFilter}
        onSignOut={handleSignOut}
        onMissionCreated={handleMissionCreated}
        onOpenMission={handleOpenMission}
      />

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
