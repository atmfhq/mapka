import { useEffect, useState, useRef, lazy, Suspense } from "react";
import { useSearchParams, useParams, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useActiveArea } from "@/hooks/useActiveArea";
import { useOnlineHeartbeat } from "@/hooks/useOnlineHeartbeat";
import { supabase } from "@/integrations/supabase/client";
import TacticalMap, { TacticalMapHandle, ViewportBounds } from "@/components/map/TacticalMap";
import Navbar from "@/components/map/Navbar";
import BottomNav from "@/components/map/BottomNav";
import GuestNavbar from "@/components/map/GuestNavbar";
import LoadingScreen from "@/components/LoadingScreen";
// Lazy loaded modals for better initial bundle size
const AuthModal = lazy(() => import("@/components/map/AuthModal"));
const OnboardingModal = lazy(() => import("@/components/map/OnboardingModal"));
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";

interface AvatarConfig {
  skinColor?: string;
  shape?: string;
  eyes?: string;
  mouth?: string;
}

const Dashboard = () => {
  const { user, profile, loading, signOut, refreshProfile, markOnline } = useAuth();
  const { lat: activeAreaLat, lng: activeAreaLng, loading: activeAreaLoading } = useActiveArea();

  // Maintain online presence with periodic heartbeats
  useOnlineHeartbeat(user?.id ?? null);

  // Mark user online when they first load the app (after authentication)
  useEffect(() => {
    if (user?.id && !loading) {
      markOnline();
    }
  }, [user?.id, loading, markOnline]);

  const [searchParams, setSearchParams] = useSearchParams();
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
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
  const onboardingModalDismissedRef = useRef(false);
  
  // Auth modal state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [spawnCoordinates, setSpawnCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  
  // Pre-fetched deep link spot data (for initializing map at correct location)
  const [deepLinkSpot, setDeepLinkSpot] = useState<{ id: string; lat: number; lng: number } | null>(null);
  const [deepLinkLoading, setDeepLinkLoading] = useState(false);
  const deepLinkFetchedRef = useRef(false);

  const isGuest = !user;
  
  // Check for deep link params in URL (query OR path params)
  const eventId = searchParams.get('eventId') || (params.eventId ?? null);
  const shareCode = searchParams.get('c') || (params.shareCode ?? null);
  const shoutId = searchParams.get('shoutId') || (params.shoutId ?? null);
  const hasEventDeepLink = !!(eventId || shareCode);
  const hasShoutDeepLink = !!shoutId;
  const hasDeepLink = hasEventDeepLink || hasShoutDeepLink;

  // Note: OG meta for social crawlers is handled by the `og-share` Edge Function.

  // Normalize legacy share-code path `/m/:shareCode` into query-param deep link to keep existing logic stable.
  useEffect(() => {
    if (location.pathname.startsWith("/m/") && shareCode) {
      navigate(`/?c=${encodeURIComponent(shareCode)}`, { replace: true });
    }
  }, [location.pathname, shareCode, navigate]);

  // Pre-fetch deep link spot/shout coordinates BEFORE map renders (for correct initial center)
  useEffect(() => {
    if (!hasDeepLink || deepLinkFetchedRef.current) return;
    
    deepLinkFetchedRef.current = true;
    setDeepLinkLoading(true);
    
    const prefetchDeepLink = async () => {
      try {
        // Handle shout deep links
        if (hasShoutDeepLink && shoutId) {
          const { data, error } = await supabase
            .from('shouts')
            .select('id, lat, lng')
            .eq('id', shoutId)
            .maybeSingle();
          
          if (!error && data) {
            setDeepLinkSpot({ id: data.id, lat: data.lat, lng: data.lng });
            if (!user) {
              setGuestLocation({ lat: data.lat, lng: data.lng });
            }
          }
        } 
        // Handle event deep links
        else if (hasEventDeepLink) {
          const { data, error } = await supabase.rpc('resolve_megaphone_link', {
            p_share_code: shareCode || null,
            p_id: eventId || null,
          });
          
          const spot = data?.[0];
          
          if (!error && spot) {
            setDeepLinkSpot({ id: spot.id, lat: spot.lat, lng: spot.lng });
            if (!user) {
              setGuestLocation({ lat: spot.lat, lng: spot.lng });
            }
          }
        }
      } catch (err) {
        console.error('Error prefetching deep link:', err);
      } finally {
        setDeepLinkLoading(false);
      }
    };
    
    prefetchDeepLink();
  }, [hasDeepLink, hasShoutDeepLink, hasEventDeepLink, shoutId, eventId, shareCode, user]);

  // Set guest location once active area is loaded (only if no deep link)
  useEffect(() => {
    if (isGuest && !activeAreaLoading && !guestLocation && !hasDeepLink) {
      setGuestLocation({ lat: activeAreaLat, lng: activeAreaLng });
    }
  }, [isGuest, activeAreaLoading, activeAreaLat, activeAreaLng, guestLocation, hasDeepLink]);

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

  // Show onboarding modal for logged-in but not onboarded users or users without age confirmation
  // Close modal if user is fully onboarded and has confirmed age
  useEffect(() => {
    if (!loading && user && profile) {
      const needsOnboarding = !profile.is_onboarded || !profile.is_18_plus;
      if (!needsOnboarding) {
        // User is fully onboarded and has confirmed age - close modal and reset dismissal flag
        setShowOnboardingModal(false);
        onboardingModalDismissedRef.current = false;
      } else if (!onboardingModalDismissedRef.current) {
        // Only open modal if it hasn't been dismissed by user and onboarding is needed
        setShowOnboardingModal(true);
      }
    }
  }, [loading, user, profile]);

  // Handle deep link after map is ready - teleport user and open spot/shout modal
  useEffect(() => {
    // Skip if no deep link, already handled, or map not ready
    if (!hasDeepLink || deepLinkHandledRef.current || !mapRef.current) return;
    
    // Wait for prefetch to complete
    if (deepLinkLoading) return;
    
    // For logged-in users, wait for profile to be loaded
    if (user && !profile) return;
    
    deepLinkHandledRef.current = true;
    
    const handleDeepLink = async () => {
      // Handle SHOUT deep links
      if (hasShoutDeepLink && shoutId) {
        let spot = deepLinkSpot;
        
        if (!spot) {
          // Fetch shout data if not prefetched
          const { data, error } = await supabase
            .from('shouts')
            .select('id, lat, lng, created_at')
            .eq('id', shoutId)
            .maybeSingle();
          
          if (error || !data) {
            toast({
              title: 'Shout not found',
              description: 'This shout may have expired or been deleted.',
              variant: 'destructive',
            });
            setSearchParams({}, { replace: true });
            return;
          }
          
          // Check if shout is expired
          const createdTime = new Date(data.created_at).getTime();
          const now = Date.now();
          const twentyFourHours = 24 * 60 * 60 * 1000;
          
          if (now - createdTime > twentyFourHours) {
            toast({
              title: 'Shout expired',
              description: 'This shout is no longer available.',
              variant: 'destructive',
            });
            setSearchParams({}, { replace: true });
            return;
          }
          
          spot = { id: data.id, lat: data.lat, lng: data.lng };
        }
        
        // For logged-in users: teleport to the shout location
        if (user && spot) {
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              location_lat: spot.lat,
              location_lng: spot.lng,
            })
            .eq('id', user.id);
          
          if (!updateError) {
            setCurrentLocation({ lat: spot.lat, lng: spot.lng, name: null });
            await refreshProfile();
          }
        } else if (spot) {
          setGuestLocation({ lat: spot.lat, lng: spot.lng });
        }
        
        if (spot) {
          mapRef.current?.flyTo(spot.lat, spot.lng);
          
          // Open the shout details drawer
          const success = await mapRef.current?.openShoutById(spot.id);
          if (!success) {
            toast({
              title: 'Shout not found',
              description: 'This shout may have expired or been deleted.',
              variant: 'destructive',
            });
          }
        }
        
        setSearchParams({}, { replace: true });
        return;
      }
      
      // Handle EVENT deep links (existing logic)
      let spot = deepLinkSpot;
      
      if (!spot) {
        try {
          const { data, error } = await supabase.rpc('resolve_megaphone_link', {
            p_share_code: shareCode || null,
            p_id: eventId || null,
          });
          
          const fetchedSpot = data?.[0];
          
          if (error || !fetchedSpot) {
            toast({
              title: 'Spot not found',
              description: 'The spot you were looking for no longer exists.',
              variant: 'destructive',
            });
            setSearchParams({}, { replace: true });
            return;
          }
          
          spot = { id: fetchedSpot.id, lat: fetchedSpot.lat, lng: fetchedSpot.lng };
        } catch (err) {
          console.error('Error handling deep link:', err);
          toast({
            title: 'Spot not found',
            description: 'Unable to load the spot details.',
            variant: 'destructive',
          });
          setSearchParams({}, { replace: true });
          return;
        }
      }
      
      // For logged-in users: teleport to the spot location
      if (user && spot) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            location_lat: spot.lat,
            location_lng: spot.lng,
          })
          .eq('id', user.id);
        
        if (updateError) {
          console.error('Error teleporting user:', updateError);
          toast({
            title: 'Failed to teleport',
            description: 'Unable to move to the event location.',
            variant: 'destructive',
          });
          setSearchParams({}, { replace: true });
          return;
        }
        
        // Update local state with new location
        setCurrentLocation({ lat: spot.lat, lng: spot.lng, name: null });
        
        // Refresh profile to sync state
        await refreshProfile();
        
        // Show arrival toast
        toast({
          title: 'You have arrived at the event location.',
        });
      } else if (spot) {
        // For guests: ensure guest location is set
        setGuestLocation({ lat: spot.lat, lng: spot.lng });
      }
      
      if (spot) {
        // Fly camera to the spot location (in case map initialized elsewhere)
        mapRef.current?.flyTo(spot.lat, spot.lng);
        
        // Open the spot details modal.
        // Prefer share code when present (works for guests via RPC), otherwise UUID.
        const openId = shareCode || eventId || spot.id;
        mapRef.current?.openMissionById(openId);
      }
      
      // Clear the deep link params after handling
      setSearchParams({}, { replace: true });
    };
    
    handleDeepLink();
  }, [hasDeepLink, hasShoutDeepLink, deepLinkLoading, deepLinkSpot, shoutId, eventId, shareCode, setSearchParams, toast, user, profile, refreshProfile]);

  const handleSignOut = async () => {
    await signOut();
  };

  // Handler for opening auth modal (called from GuestNavbar or GuestPromptModal)
  const handleOpenAuthModal = () => {
    // Prefer explicit spawn intent coordinates (e.g. guest clicked on the map)
    const spawnIntent = sessionStorage.getItem('spawn_intent_coords');
    if (spawnIntent) {
      try {
        const parsed = JSON.parse(spawnIntent) as { lat?: number; lng?: number };
        if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
          setSpawnCoordinates({ lat: parsed.lat, lng: parsed.lng });
          sessionStorage.removeItem('spawn_intent_coords');
          setShowAuthModal(true);
          return;
        }
      } catch {
        // ignore and fall back
      }
      sessionStorage.removeItem('spawn_intent_coords');
    }

    // Capture current map center as spawn coordinates
    const mapCenter = mapRef.current?.getCenter?.();
    if (mapCenter) {
      setSpawnCoordinates({ lat: mapCenter.lat, lng: mapCenter.lng });
    } else {
      // Fallback to guest location or active area
      setSpawnCoordinates({
        lat: guestLocation?.lat ?? activeAreaLat,
        lng: guestLocation?.lng ?? activeAreaLng
      });
    }
    setShowAuthModal(true);
  };

  const handleMissionCreated = () => {
    mapRef.current?.fetchQuests();
  };

  const handleOpenMission = (missionId: string) => {
    mapRef.current?.openMissionById(missionId);
  };

  const handleOpenShout = (shoutId: string) => {
    // Open shout drawer (used by notifications)
    mapRef.current?.openShoutById(shoutId);
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

  // Show loading for guests waiting for active area or deep link, or logged-in users waiting for profile
  if (loading || (isGuest && activeAreaLoading && !deepLinkSpot) || (hasDeepLink && deepLinkLoading)) {
    return <LoadingScreen />;
  }

  // For logged-in users, wait for profile
  if (user && !profile) {
    return <LoadingScreen />;
  }

  // Determine map center - prioritize deep link spot, then guest location, then active area
  const guestLat = deepLinkSpot?.lat ?? guestLocation?.lat ?? activeAreaLat;
  const guestLng = deepLinkSpot?.lng ?? guestLocation?.lng ?? activeAreaLng;
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
          selectedDate={selectedDate}
          onSelectedDateChange={setSelectedDate}
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
          onOpenAuthModal={handleOpenAuthModal}
        />
      </div>

      {/* Navbar - z-50 floating above everything */}
      {isGuest ? (
        <GuestNavbar onFlyTo={handleFlyTo} onOpenAuthModal={handleOpenAuthModal} />
      ) : (
        <Navbar
          nick={profile?.nick || "Adventurer"}
          avatarUrl={profile?.avatar_url ?? null}
          avatarConfig={profile?.avatar_config as AvatarConfig | null}
          currentUserId={user.id}
          onSignOut={handleSignOut}
          onMissionCreated={handleMissionCreated}
          onOpenMission={handleOpenMission}
          onOpenShout={handleOpenShout}
          chatOpenUserId={chatOpenUserId}
          chatOpenEventId={chatOpenEventId}
          onChatOpenChange={handleChatOpenChange}
          onOpenChatWithUser={handleOpenChatWithUser}
          onFlyTo={handleFlyTo}
          onLocationUpdated={handleLocationUpdated}
          viewportBounds={viewportBounds}
        />
      )}

      {/* Bottom Navigation - Mobile only, for logged-in users */}
      {!isGuest && isMobile && (
        <BottomNav
          currentUserId={user.id}
          avatarConfig={profile?.avatar_config as AvatarConfig | null}
          onSignOut={handleSignOut}
          onOpenMission={handleOpenMission}
          onOpenShout={handleOpenShout}
          chatOpenUserId={chatOpenUserId}
          onChatOpenChange={handleChatOpenChange}
          onOpenChatWithUser={handleOpenChatWithUser}
          onFlyTo={handleFlyTo}
          viewportBounds={viewportBounds}
        />
      )}

      {/* Status indicator - z-30 floating bottom left with safe area - Only show for guests */}
      {isGuest && (
        <div className="fixed left-4 z-30 safe-area-left bottom-4">
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

      {/* Auth Modal - Lazy loaded */}
      <Suspense fallback={null}>
        <AuthModal
          open={showAuthModal}
          onOpenChange={setShowAuthModal}
          spawnCoordinates={spawnCoordinates}
        />
      </Suspense>

      {/* Onboarding Modal - Lazy loaded */}
      <Suspense fallback={null}>
        <OnboardingModal
          open={showOnboardingModal}
          onOpenChange={(isOpen) => {
            setShowOnboardingModal(isOpen);
            // Track if user manually dismissed the modal
            if (!isOpen) {
              onboardingModalDismissedRef.current = true;
            }
          }}
          spawnCoordinates={spawnCoordinates}
          onComplete={() => {
            // Reset dismissal flag on successful completion
            onboardingModalDismissedRef.current = false;
          }}
        />
      </Suspense>
    </div>
  );
};

export default Dashboard;
