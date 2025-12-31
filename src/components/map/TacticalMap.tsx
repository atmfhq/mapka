import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { createRoot, Root } from 'react-dom/client';
import { supabase } from '@/integrations/supabase/client';
import ProfileModal from './ProfileModal';
import DeployQuestModal from './DeployQuestModal';
import QuestLobby from './QuestLobby';
import GuestPromptModal from './GuestPromptModal';
import GuestSpawnTooltip from './GuestSpawnTooltip';
import MapContextMenu from './MapContextMenu';
import ShoutModal from './ShoutModal';
import ShoutDetailsDrawer from './ShoutDetailsDrawer';
import FloatingParticles from './FloatingParticles';
import BubbleChat, { ActiveBubble } from './BubbleChat';
import AvatarDisplay from '@/components/avatar/AvatarDisplay';
import { Json } from '@/integrations/supabase/types';
import { ACTIVITIES, getCategoryForActivity, getActivityById } from '@/constants/activities';
import { useConnectedUsers } from '@/hooks/useConnectedUsers';
import { useProfilesRealtime, broadcastCurrentUserUpdate } from '@/hooks/useProfilesRealtime';
import { useMegaphonesRealtime } from '@/hooks/useMegaphonesRealtime';
import { useParticipantsRealtime } from '@/hooks/useParticipantsRealtime';
import { useShoutsRealtime, Shout } from '@/hooks/useShoutsRealtime';
import { useShoutCounts } from '@/hooks/useShoutCounts';
import { useProximityAlerts, useFollowingIds } from '@/hooks/useProximityAlerts';
import ShoutMarker from './ShoutMarker';
import { Button } from '@/components/ui/button';
import { Crosshair, Plus, Minus, Compass, Users, UsersRound, Eye, Ghost } from 'lucide-react';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || 'YOUR_MAPBOX_TOKEN_HERE';

interface AvatarConfig {
  skinColor?: string;
  shape?: string;
  eyes?: string;
  mouth?: string;
}

interface Profile {
  id: string;
  nick: string | null;
  avatar_url: string | null;
  avatar_config: AvatarConfig | null;
  tags: string[] | null;
  location_lat: number | null;
  location_lng: number | null;
  bio: string | null;
  is_active: boolean;
  last_bounce_at?: string | null;
}

interface Quest {
  id: string;
  title: string;
  category: string;
  start_time: string;
  duration_minutes: number;
  max_participants: number | null;
  lat: number;
  lng: number;
  host_id: string;
  is_private?: boolean;
  share_code?: string;
}

export type DateFilter = 'today' | '3days' | '7days';

export interface ViewportBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface TacticalMapProps {
  userLat: number;
  userLng: number;
  baseLat: number;
  baseLng: number;
  currentUserId: string | null;
  activeActivities: string[];
  dateFilter: DateFilter;
  currentUserAvatarConfig?: AvatarConfig | null;
  locationLat?: number | null;
  locationLng?: number | null;
  isGhostMode?: boolean;
  onGhostModeChange?: (isGhost: boolean) => void;
  isGuest?: boolean;
  onOpenChatWithUser?: (userId: string) => void;
  onOpenSpotChat?: (eventId: string) => void;
  onCloseChat?: () => void;
  onLocationUpdated?: (lat: number, lng: number) => void;
  onViewportChange?: (bounds: ViewportBounds) => void;
}

export interface TacticalMapHandle {
  fetchQuests: () => void;
  openMissionById: (id: string) => void;
  flyTo: (lat: number, lng: number) => void;
}

// Category colors with distinct, vibrant hues (HSL format)
const CATEGORY_COLORS: Record<string, string> = {
  sport: '15, 100%, 55%',      // Orange-red
  tabletop: '200, 100%, 50%',  // Cyan-blue
  social: '45, 100%, 55%',     // Warm yellow
  outdoor: '145, 70%, 45%',    // Emerald green
  // Legacy fallbacks
  Sport: '15, 100%, 55%',
  Gaming: '200, 100%, 50%',
  Food: '45, 100%, 55%',
  Party: '320, 100%, 60%',
  Other: '270, 70%, 60%',      // Purple fallback
};

// Get activity icon by label (case insensitive)
const getActivityIcon = (label: string): string => {
  const activity = ACTIVITIES.find(a => a.label.toLowerCase() === label.toLowerCase());
  return activity?.icon || '📍';
};

// Get category color from activity label
const getCategoryColor = (label: string): string => {
  const category = getCategoryForActivity(label);
  if (category && CATEGORY_COLORS[category]) {
    return CATEGORY_COLORS[category];
  }
  // Try direct match
  if (CATEGORY_COLORS[label]) {
    return CATEGORY_COLORS[label];
  }
  return CATEGORY_COLORS.Other;
};

// Deterministic jitter based on user ID (stable across renders)
// Returns offsets of roughly +/- 50m (approx +/- 0.0005 degrees) for precise positioning
const getDeterministicOffset = (id: string): { lat: number; lng: number } => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  // Normalize to range -0.0005 to +0.0005 (approx 50m) for accurate positioning
  const latOffset = ((hash % 1000) / 1000) * 0.001 - 0.0005;
  const lngOffset = (((hash >> 8) % 1000) / 1000) * 0.001 - 0.0005;
  return { lat: latOffset, lng: lngOffset };
};


// Generate circle coordinates (approximated with 64 points)
const generateCircleCoords = (centerLng: number, centerLat: number, radiusMeters: number): [number, number][] => {
  const points = 64;
  const coords: [number, number][] = [];
  
  // Go counter-clockwise for the hole (interior ring)
  for (let i = points; i >= 0; i--) {
    const angle = (i / points) * 2 * Math.PI;
    const dx = radiusMeters * Math.cos(angle);
    const dy = radiusMeters * Math.sin(angle);
    
    // Convert meters to degrees
    const latOffset = dy / 111320;
    const lngOffset = dx / (111320 * Math.cos(centerLat * (Math.PI / 180)));
    
    coords.push([centerLng + lngOffset, centerLat + latOffset]);
  }
  
  return coords;
};

// Generate a "Fog of War" mask - covers the world EXCEPT the circle (donut technique)
const createFogOfWarMask = (centerLng: number, centerLat: number, radiusMeters: number): GeoJSON.Feature<GeoJSON.Polygon> => {
  // Exterior ring: covers the entire world (clockwise for exterior)
  const worldBounds: [number, number][] = [
    [-180, -90],
    [-180, 90],
    [180, 90],
    [180, -90],
    [-180, -90]
  ];
  
  // Interior ring: the 5km circle (counter-clockwise for hole)
  const circleHole = generateCircleCoords(centerLng, centerLat, radiusMeters);
  
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [worldBounds, circleHole]
    }
  };
};

// Generate just the circle for the border (simple polygon)
const createCircleBorder = (centerLng: number, centerLat: number, radiusMeters: number): GeoJSON.Feature<GeoJSON.Polygon> => {
  const points = 64;
  const coords: [number, number][] = [];
  
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const dx = radiusMeters * Math.cos(angle);
    const dy = radiusMeters * Math.sin(angle);
    
    const latOffset = dy / 111320;
    const lngOffset = dx / (111320 * Math.cos(centerLat * (Math.PI / 180)));
    
    coords.push([centerLng + lngOffset, centerLat + latOffset]);
  }
  
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [coords]
    }
  };
};

const TacticalMap = forwardRef<TacticalMapHandle, TacticalMapProps>(({ 
  userLat, 
  userLng,
  baseLat,
  baseLng,
  currentUserId, 
  activeActivities,
  dateFilter,
  currentUserAvatarConfig,
  locationLat,
  locationLng,
  isGhostMode = false,
  onGhostModeChange,
  isGuest = false,
  onOpenChatWithUser,
  onOpenSpotChat,
  onCloseChat,
  onLocationUpdated,
  onViewportChange
}, ref) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  // Use Maps keyed by ID for incremental marker updates (no re-blooming)
  const userMarkersMapRef = useRef<Map<string, { marker: mapboxgl.Marker; root: Root; element: HTMLDivElement }>>(new Map());
  const questMarkersMapRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const shoutMarkersMapRef = useRef<Map<string, { marker: mapboxgl.Marker; root: Root }>>(new Map());
  const myMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const myMarkerRootRef = useRef<Root | null>(null);
  
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [joinedQuestIds, setJoinedQuestIds] = useState<Set<string>>(new Set());
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  
  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const [guestPromptOpen, setGuestPromptOpen] = useState(false);
  const [guestPromptVariant, setGuestPromptVariant] = useState<'join' | 'connect' | 'create' | 'view'>('create');
  const [clickedCoords, setClickedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [contextMenuCoords, setContextMenuCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [contextMenuScreenPos, setContextMenuScreenPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
  const [lobbyOpen, setLobbyOpen] = useState(false);
  const [isTacticalView, setIsTacticalView] = useState(true);
  const [mapStyleLoaded, setMapStyleLoaded] = useState(false); // Track when style is ready for markers
  const [lastBounceTime, setLastBounceTime] = useState<number>(0); // Cooldown for bounce action
  const [myBounceCount, setMyBounceCount] = useState<number>(0); // For instant animation reset on spam clicks
  const [particleTrigger, setParticleTrigger] = useState<number>(0); // For spawning particles
  const lastDbUpdateRef = useRef<number>(0); // Throttle DB updates separately from visual
  const bounceTimestampsRef = useRef<Map<string, string>>(new Map()); // Track last bounce timestamps per user
  const [showUsers, setShowUsers] = useState(true); // Toggle visibility of user avatars on map
  const [activeBubbles, setActiveBubbles] = useState<Map<string, ActiveBubble>>(new Map()); // Speech bubbles per user
  const speechBubbleRootsRef = useRef<Map<string, Root>>(new Map()); // Roots for speech bubble DOM elements
  const bubbleOverlayRef = useRef<HTMLDivElement>(null); // Overlay container for all bubbles
  const [shoutModalOpen, setShoutModalOpen] = useState(false); // Shout modal state
  const [shoutCoords, setShoutCoords] = useState<{ lat: number; lng: number } | null>(null); // Shout coordinates
  const [selectedShout, setSelectedShout] = useState<{ id: string; user_id: string; content: string; lat: number; lng: number; created_at: string } | null>(null); // Selected shout for details drawer
  const [shoutDetailsOpen, setShoutDetailsOpen] = useState(false); // Shout details drawer state
  
  const navigate = useNavigate();

  // Get connected users (skip for guests)
  const { connectedUserIds, getInvitationIdForUser, refetch: refetchConnections } = useConnectedUsers(currentUserId ?? '');

  // Get list of users we're following (for proximity alerts)
  const followingIds = useFollowingIds(currentUserId);
  
  // Proximity alerts hook
  const { processNewItems } = useProximityAlerts(currentUserId, followingIds);

  // Ref to track previous shout IDs for proximity detection
  const previousShoutIdsRef = useRef<Set<string>>(new Set());

  // Callback for when new shouts appear in range
  const handleNewShoutsInRange = useCallback((newShouts: Shout[], allShouts: Shout[]) => {
    if (!currentUserId || followingIds.length === 0) return;
    
    const items = newShouts.map(s => ({
      id: s.id,
      user_id: s.user_id,
      type: 'shout' as const
    }));
    
    processNewItems(items, previousShoutIdsRef.current);
    
    // Update previous IDs ref
    previousShoutIdsRef.current = new Set(allShouts.map(s => s.id));
  }, [currentUserId, followingIds, processNewItems]);

  // Get shouts for the map (with hidden shouts filtered for current user)
  const { shouts, refetch: refetchShouts, hideShout } = useShoutsRealtime(
    locationLat ?? userLat, 
    locationLng ?? userLng, 
    currentUserId ?? undefined,
    { onNewItemsInRange: handleNewShoutsInRange }
  );

  // Get counts (likes/comments) for all shouts
  const shoutIds = useMemo(() => shouts.map(s => s.id), [shouts]);
  const { getCounts: getShoutCounts } = useShoutCounts(shoutIds);

  // Get active activity labels for filtering
  const activeActivityLabels = useMemo(() => 
    activeActivities.map(id => getActivityById(id)?.label?.toLowerCase()).filter(Boolean) as string[],
    [activeActivities]
  );

  // Filter profiles based on active activities AND is_active status
  // Rule: Only show active users, EXCEPT always show current user (themselves)
  const filteredProfiles = useMemo(() => {
    // First filter by is_active (but always include current user)
    const activeProfiles = profiles.filter(profile => 
      profile.is_active || profile.id === currentUserId
    );
    
    // Then filter by activities if any are selected
    if (activeActivities.length === 0) return activeProfiles;
    
    return activeProfiles.filter(profile => {
      if (!profile.tags || profile.tags.length === 0) return false;
      // Show profile if ANY of their tags match ANY of the active filters
      return profile.tags.some(tag => 
        activeActivityLabels.includes(tag.toLowerCase())
      );
    });
  }, [profiles, activeActivities, activeActivityLabels, currentUserId]);

  // Handle bounce/wave action - INSTANT visual, THROTTLED database
  const handleBounce = useCallback(async () => {
    if (!currentUserId || isGuest) return;
    
    // ALWAYS trigger visual feedback immediately (spammable)
    setMyBounceCount(prev => prev + 1);
    setParticleTrigger(prev => prev + 1);
    
    // Throttle database updates (max 1 per 500ms)
    const now = Date.now();
    const DB_THROTTLE_MS = 500;
    
    if (now - lastDbUpdateRef.current < DB_THROTTLE_MS) {
      // Skip DB update, but visual already triggered
      return;
    }
    
    lastDbUpdateRef.current = now;
    
    // Update database (throttled)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ last_bounce_at: new Date().toISOString() })
        .eq('id', currentUserId);
      
      if (error) {
        console.error('Error updating bounce timestamp:', error);
      } else {
        // Broadcast bounce for real-time sync (includes full profile data)
        const lat = locationLat ?? userLat;
        const lng = locationLng ?? userLng;
        await broadcastCurrentUserUpdate(currentUserId, lat, lng, 'bounce');
      }
    } catch (err) {
      console.error('Failed to trigger bounce:', err);
    }
  }, [currentUserId, isGuest, locationLat, locationLng, userLat, userLng]);

  // Filter quests - HIDE PRIVATE EVENTS from map, apply date filter
  const filteredQuests = useMemo(() => {
    const now = Date.now();
    
    // Calculate date filter cutoff
    const getDateCutoff = (): number => {
      switch (dateFilter) {
        case 'today':
          // End of today
          const endOfToday = new Date();
          endOfToday.setHours(23, 59, 59, 999);
          return endOfToday.getTime();
        case '3days':
          return now + (3 * 24 * 60 * 60 * 1000);
        case '7days':
        default:
          return now + (7 * 24 * 60 * 60 * 1000);
      }
    };
    
    const dateCutoff = getDateCutoff();
    
    // First filter out private events - they should not appear on map
    const publicQuests = quests.filter(m => !m.is_private);
    
    // Apply date filter:
    // Show quests that:
    // 1. Start within the selected timeframe, OR
    // 2. Are currently ongoing (started in past but end in future)
    // AND exclude expired quests
    const dateFilteredQuests = publicQuests.filter(q => {
      const startTime = new Date(q.start_time).getTime();
      const endTime = startTime + (q.duration_minutes * 60 * 1000);
      
      // Exclude expired quests
      if (endTime < now) return false;
      
      // Include if currently ongoing (started but not ended)
      if (startTime <= now && endTime > now) return true;
      
      // Include if starts within the date filter range
      return startTime <= dateCutoff;
    });
    
    // Apply activity filter if any are active
    if (activeActivities.length === 0) return dateFilteredQuests;
    
    return dateFilteredQuests.filter(q => {
      const questCat = q.category.toLowerCase();
      // Show quest if its category matches ANY of the active filters
      return activeActivities.some(activityId => {
        const activityLabel = getActivityById(activityId)?.label?.toLowerCase();
        return questCat === activityLabel || questCat === activityId;
      });
    });
  }, [quests, activeActivities, dateFilter]);

  // Fetch nearby profiles using spatial RPC - refetch when location changes
  const fetchProfiles = useCallback(async () => {
    // Use the current user's location as the center point
    const centerLat = locationLat ?? userLat;
    const centerLng = locationLng ?? userLng;
    
    setIsDataLoading(true);
    
    const { data, error } = await supabase.rpc('get_nearby_profiles', {
      p_lat: centerLat,
      p_lng: centerLng,
      p_radius_meters: 5000 // 5km radius
    });
    
    if (!error && data) {
      const mappedProfiles = data.map((p: any) => ({
        ...p,
        avatar_config: p.avatar_config as AvatarConfig | null,
        is_active: p.is_active ?? true,
        last_bounce_at: p.last_bounce_at ?? null
      }));
      setProfiles(mappedProfiles);
    } else if (error) {
      console.error('Error fetching nearby profiles:', error);
    }
    
    setIsDataLoading(false);
  }, [locationLat, locationLng, userLat, userLng]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  // Callback to trigger bounce animation on a specific remote user
  const triggerRemoteUserBounce = useCallback((userId: string, bounceAt: string) => {
    // Skip if it's our own bounce
    if (userId === currentUserId) return;
    
    const existing = userMarkersMapRef.current.get(userId);
    if (!existing) return;
    
    // Get the profile for this user
    const profile = profiles.find(p => p.id === userId);
    if (!profile) return;
    
    const isConnected = connectedUserIds.has(userId);
    const bounceKey = Date.now();
    
    // Re-render with particles and animation
    existing.root.render(
      <div 
        key={bounceKey}
        className={`user-avatar-marker animate-bounce-wave ${isConnected ? 'connected' : ''}`}
      >
        <AvatarDisplay 
          config={profile.avatar_config} 
          size={40} 
          showGlow={false}
        />
        <FloatingParticles trigger={bounceKey} />
      </div>
    );
  }, [currentUserId, profiles, connectedUserIds]);

  // Surgical update of a single user's marker position (no full refetch)
  const updateUserMarkerPosition = useCallback((userId: string, newLat: number, newLng: number) => {
    const existing = userMarkersMapRef.current.get(userId);
    if (!existing) {
      // User not currently on map - might need to add them, trigger a light refresh
      console.log('[Realtime] User not on map, adding to profiles:', userId);
      setProfiles(prev => {
        // Will be added on next fetch if in range
        return prev;
      });
      return;
    }
    
    // Calculate jittered position (same formula as initial render)
    const offset = getDeterministicOffset(userId);
    const jitteredLat = newLat + offset.lat;
    const jitteredLng = newLng + offset.lng;
    
    // Smooth fly animation to new position
    const marker = existing.marker;
    const currentPos = marker.getLngLat();
    const duration = 800;
    const startTime = performance.now();
    const startLng = currentPos.lng;
    const startLat = currentPos.lat;
    
    // Check if position actually changed
    const distance = Math.sqrt(
      Math.pow(currentPos.lng - jitteredLng, 2) + 
      Math.pow(currentPos.lat - jitteredLat, 2)
    );
    
    if (distance < 0.00001) return; // Less than ~1m, skip
    
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutCubic(progress);
      
      const newLng = startLng + (jitteredLng - startLng) * easedProgress;
      const newLat = startLat + (jitteredLat - startLat) * easedProgress;
      
      marker.setLngLat([newLng, newLat]);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    console.log('[Realtime] ✓ Animating user marker to new position:', userId);
    requestAnimationFrame(animate);
  }, []);

  // Handle incoming chat bubbles from realtime
  const handleChatBubbleReceived = useCallback((payload: { user_id: string; message: string }) => {
    // Don't duplicate our own bubble - we show it instantly on send
    if (payload.user_id === currentUserId) return;
    
    const bubble: ActiveBubble = {
      userId: payload.user_id,
      message: payload.message,
      expiresAt: Date.now() + 7000, // 7 second display
    };
    
    setActiveBubbles(prev => {
      const next = new Map(prev);
      next.set(bubble.userId, bubble);
      return next;
    });
  }, [currentUserId]);

  // Handle local bubble (from BubbleChat component for instant feedback)
  const handleLocalBubble = useCallback((bubble: ActiveBubble) => {
    setActiveBubbles(prev => {
      const next = new Map(prev);
      next.set(bubble.userId, bubble);
      return next;
    });
  }, []);

  // Realtime subscription for live multiplayer updates - SURGICAL UPDATES via Broadcast
  // Now enabled for EVERYONE (including guests) for public "window shopping"
  const { sendChatMessage } = useProfilesRealtime({
    currentUserId,
    userLat: locationLat ?? userLat,
    userLng: locationLng ?? userLng,
    radiusMeters: 5000,
    enabled: true, // Always enabled - guests can watch, only logged-in users can broadcast
    onProfileUpdate: useCallback((incoming: any) => {
      // Skip our own updates (only applies to logged-in users)
      if (currentUserId && incoming.id === currentUserId) return;

      console.log('[Realtime] Broadcast profile update -> setProfiles merge:', incoming?.id);

      // CRITICAL: Always update React state via functional update to force re-render
      setProfiles((prev) => {
        const id = incoming?.id;
        if (!id) return prev;

        // If user went inactive, remove immediately
        if (incoming.is_active === false) {
          return prev.filter((p) => p.id !== id);
        }

        const exists = prev.some((p) => p.id === id);
        if (exists) {
          return prev.map((p) => (p.id === id ? { ...p, ...incoming } : p));
        }

        // New user appeared - add to list
        return [...prev, incoming];
      });

      // Move marker immediately if we have coordinates (allow 0 values)
      if (incoming.location_lat != null && incoming.location_lng != null) {
        updateUserMarkerPosition(incoming.id, incoming.location_lat, incoming.location_lng);
      }
    }, [currentUserId, updateUserMarkerPosition]),
    onBounceUpdate: triggerRemoteUserBounce,
    onChatBubble: handleChatBubbleReceived,
  });

  // DATABASE-DRIVEN realtime: postgres_changes for TRUE background updates
  // This fires even when other users move without broadcasting (e.g., via edit profile)
  useEffect(() => {
    if (!currentUserId) return;

    console.log('[DB Realtime] Setting up postgres_changes subscription for profiles');

    const channel = supabase
      .channel('tactical-map-profiles-db')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
        },
        (payload) => {
          const profile = payload.new as Record<string, any> | null;
          const oldRecord = payload.old as Record<string, any> | null;
          const recordId = profile?.id || oldRecord?.id;

          // Skip own updates
          if (recordId === currentUserId) return;

          console.log('[DB Realtime] Profile change:', payload.eventType, recordId);

          if (payload.eventType === 'DELETE' && oldRecord?.id) {
            setProfiles(prev => prev.filter(p => p.id !== oldRecord.id));
            return;
          }

          if (!profile) return;

          // Skip users without location or not onboarded
          if (!profile.location_lat || !profile.location_lng || !profile.is_onboarded) {
            setProfiles(prev => prev.filter(p => p.id !== profile.id));
            return;
          }

          // Update profiles state
          const mappedProfile: Profile = {
            id: profile.id,
            nick: profile.nick ?? null,
            avatar_url: profile.avatar_url ?? null,
            avatar_config: profile.avatar_config as AvatarConfig | null,
            tags: profile.tags ?? null,
            location_lat: profile.location_lat,
            location_lng: profile.location_lng,
            bio: profile.bio ?? null,
            is_active: profile.is_active ?? true,
            last_bounce_at: profile.last_bounce_at ?? null,
          };

          setProfiles(prev => {
            const exists = prev.some(p => p.id === profile.id);
            if (exists) {
              return prev.map(p => p.id === profile.id ? mappedProfile : p);
            }
            return [...prev, mappedProfile];
          });

          // Animate marker to new position
          if (profile.location_lat != null && profile.location_lng != null) {
            updateUserMarkerPosition(profile.id, profile.location_lat, profile.location_lng);
          }
        }
      )
      .subscribe((status) => {
        console.log('[DB Realtime] postgres_changes subscription status:', status);
      });

    return () => {
      console.log('[DB Realtime] Cleaning up postgres_changes subscription');
      supabase.removeChannel(channel);
    };
  }, [currentUserId, updateUserMarkerPosition]);

  // Realtime subscription for live quest/megaphone updates
  // Now enabled for guests too (public quests are visible to everyone)
  useMegaphonesRealtime({
    enabled: true, // Guests can see public quest updates
    onInsert: useCallback((megaphone: any) => {
      console.log('[Realtime] New quest created:', megaphone.id);
      // Add new quest to local state if within our area
      setQuests(prev => {
        // Check if already exists
        if (prev.some(q => q.id === megaphone.id)) return prev;
        // Add to list - filtering will handle visibility
        return [...prev, megaphone];
      });
    }, []),
    onUpdate: useCallback((megaphone: any) => {
      console.log('[Realtime] Quest updated:', megaphone.id);
      // Update existing quest in local state
      setQuests(prev => prev.map(q => 
        q.id === megaphone.id ? { ...q, ...megaphone } : q
      ));
    }, []),
    onDelete: useCallback((megaphoneId: string) => {
      console.log('[Realtime] Quest deleted:', megaphoneId);
      // Remove from local state
      setQuests(prev => prev.filter(q => q.id !== megaphoneId));
    }, []),
  });

  // Trigger visual pulse on quest marker when someone joins
  const triggerQuestJoinPulse = useCallback((eventId: string) => {
    const markerEntry = questMarkersMapRef.current.get(eventId);
    if (!markerEntry) return;
    
    const el = markerEntry.getElement();
    const container = el?.querySelector('.quest-container');
    if (container) {
      // Add join pulse animation class
      container.classList.add('quest-join-pulse');
      // Remove after animation completes
      setTimeout(() => {
        container.classList.remove('quest-join-pulse');
      }, 800);
    }
  }, []);

  // Realtime subscription for quest participation updates
  useParticipantsRealtime({
    enabled: !isGuest,
    onJoin: useCallback((eventId: string, userId: string) => {
      console.log('[Realtime] User joined quest:', { eventId, userId });
      // Trigger visual pulse on the quest marker
      triggerQuestJoinPulse(eventId);
      // Update joined quest IDs if it's the current user
      if (userId === currentUserId) {
        setJoinedQuestIds(prev => new Set([...prev, eventId]));
      }
    }, [currentUserId, triggerQuestJoinPulse]),
    onLeave: useCallback((eventId: string, userId: string) => {
      console.log('[Realtime] User left quest:', { eventId, userId });
      // Update joined quest IDs if it's the current user
      if (userId === currentUserId) {
        setJoinedQuestIds(prev => {
          const next = new Set(prev);
          next.delete(eventId);
          return next;
        });
      }
    }, [currentUserId]),
  });

  const fetchQuests = useCallback(async () => {
    // Use the current user's location as the center point
    const centerLat = locationLat ?? userLat;
    const centerLng = locationLng ?? userLng;
    
    const { data, error } = await supabase.rpc('get_nearby_megaphones', {
      p_lat: centerLat,
      p_lng: centerLng,
      p_radius_meters: 5000 // 5km radius
    });
    
    if (!error && data) {
      setQuests(data);
    } else if (error) {
      console.error('Error fetching nearby quests:', error);
    }
  }, [locationLat, locationLng, userLat, userLng]);

  // Fetch quests the current user has joined (skip for guests)
  const fetchJoinedQuestIds = useCallback(async () => {
    if (!currentUserId) {
      setJoinedQuestIds(new Set());
      return;
    }
    
    const { data, error } = await supabase
      .from('event_participants')
      .select('event_id')
      .eq('user_id', currentUserId)
      .eq('status', 'joined');
    
    if (!error && data) {
      setJoinedQuestIds(new Set(data.map(p => p.event_id)));
    }
  }, [currentUserId]);

  // Fetch joined quests on mount and when quests change
  useEffect(() => {
    fetchJoinedQuestIds();
  }, [fetchJoinedQuestIds, quests]);

  const openMissionById = useCallback(async (missionId: string) => {
    const { data } = await supabase
      .from('megaphones')
      .select('*')
      .eq('id', missionId)
      .maybeSingle();
    
    if (data) {
      setSelectedQuest(data);
      setLobbyOpen(true);
    }
  }, []);

  const flyTo = useCallback((lat: number, lng: number) => {
    if (map.current) {
      const currentZoom = map.current.getZoom();
      
      // Smooth drone-like flight with zoom-out/zoom-in effect
      map.current.flyTo({
        center: [lng, lat],
        zoom: Math.max(currentZoom, 14), // Maintain or zoom in
        pitch: 45,
        duration: 2500, // 2.5 seconds for smooth travel
        essential: true,
        curve: 1.5, // Controls the zooming arc - higher = more zoom out during flight
        easing: (t) => {
          // Smooth ease-in-out-quad
          return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        },
      });
    }
  }, []);

  useImperativeHandle(ref, () => ({
    fetchQuests,
    openMissionById,
    flyTo,
  }), [fetchQuests, openMissionById, flyTo]);

  // Refetch quests when location changes
  useEffect(() => {
    fetchQuests();
  }, [fetchQuests]);

  // Realtime subscription for quests (INSERT, UPDATE, DELETE)
  useEffect(() => {
    console.log('Setting up quests realtime subscription...');
    
    const channel = supabase
      .channel('quests-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'megaphones',
        },
        (payload) => {
          console.log('🔔 Realtime: New quest inserted:', payload.new);
          const newQuest = payload.new as Quest;
          // Only add public quests
          if (!newQuest.is_private) {
            setQuests(prev => {
              // Avoid duplicates
              if (prev.some(q => q.id === newQuest.id)) return prev;
              return [...prev, newQuest];
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'megaphones',
        },
        (payload) => {
          console.log('🔔 Realtime: Quest updated:', payload.new);
          const updatedQuest = payload.new as Quest;
          setQuests(prev => 
            prev.map(q => q.id === updatedQuest.id ? updatedQuest : q)
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'megaphones',
        },
        (payload) => {
          console.log('🔔 Realtime: Quest deleted:', payload.old);
          const deletedId = (payload.old as { id: string }).id;
          setQuests(prev => prev.filter(q => q.id !== deletedId));
        }
      )
      .subscribe((status) => {
        console.log('Quests realtime subscription status:', status);
      });

    return () => {
      console.log('Cleaning up quests realtime subscription');
      supabase.removeChannel(channel);
    };
  }, []);

  // NOTE: We intentionally do NOT subscribe to `postgres_changes` on `profiles`.
  // With strict profile RLS (users can only SELECT their own row), those realtime payloads are
  // silently filtered for other users, which breaks passive observation.
  // Live map movement/reactions are handled via Broadcast + secure RPC re-fetch (useProfilesRealtime).

  // Store initial coords in a ref to avoid re-creating map
  const initialCoordsRef = useRef({ lat: userLat, lng: userLng });
  const isGuestRef = useRef(isGuest);
  
  // Keep isGuest ref in sync for use in click handler
  useEffect(() => {
    isGuestRef.current = isGuest;
  }, [isGuest]);

  // Initialize map ONCE - do not recreate on coordinate changes
  useEffect(() => {
    if (!mapContainer.current) return;
    if (map.current) return; // Already initialized - don't recreate

    if (!MAPBOX_TOKEN || MAPBOX_TOKEN === 'YOUR_MAPBOX_TOKEN_HERE') {
      console.error('Mapbox token not configured');
      return;
    }

    mapboxgl.accessToken = MAPBOX_TOKEN;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/outdoors-v12',
        center: [initialCoordsRef.current.lng, initialCoordsRef.current.lat],
        zoom: 14,
        pitch: 45,
      });

      // Track when style is loaded so marker effects can run
      map.current.on('load', () => {
        setMapStyleLoaded(true);
        // Emit initial viewport bounds
        if (map.current && onViewportChange) {
          const bounds = map.current.getBounds();
          onViewportChange({
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest(),
          });
        }
      });

      // Track viewport changes for connections filtering
      const emitViewportBounds = () => {
        if (map.current && onViewportChange) {
          const bounds = map.current.getBounds();
          onViewportChange({
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest(),
          });
        }
      };

      map.current.on('moveend', emitViewportBounds);
      map.current.on('zoomend', emitViewportBounds);

      // No default controls - we use custom ones

      map.current.on('click', (e) => {
        const target = e.originalEvent.target as HTMLElement;
        if (target.closest('.user-marker') || target.closest('.megaphone-marker') || target.closest('.quest-marker')) {
          return;
        }
        
        // Guest clicked on map - save spawn coords and show guest prompt
        if (isGuestRef.current) {
          const spawnCoords = { lat: e.lngLat.lat, lng: e.lngLat.lng };
          sessionStorage.setItem('spawn_intent_coords', JSON.stringify(spawnCoords));
          setGuestPromptVariant('create');
          setGuestPromptOpen(true);
          return;
        }
        
        // Logged-in user clicked - show context menu
        setContextMenuCoords({ lat: e.lngLat.lat, lng: e.lngLat.lng });
        setContextMenuScreenPos({ x: e.point.x, y: e.point.y });
        setSelectedUser(null);
        setProfileModalOpen(false);
      });
    } catch (error) {
      console.error('Failed to initialize map:', error);
    }

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []); // Empty deps - initialize only once

  // Fly to new location when coordinates change (separate from init)
  const prevLocationRef = useRef<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  
  useEffect(() => {
    if (!map.current) return;
    
    const targetLat = locationLat ?? userLat;
    const targetLng = locationLng ?? userLng;
    
    // Skip if location hasn't actually changed
    if (prevLocationRef.current.lat === targetLat && prevLocationRef.current.lng === targetLng) {
      return;
    }
    
    // Skip on initial mount (let the map center handle it)
    if (prevLocationRef.current.lat === null && prevLocationRef.current.lng === null) {
      prevLocationRef.current = { lat: targetLat, lng: targetLng };
      return;
    }
    
    prevLocationRef.current = { lat: targetLat, lng: targetLng };
    
    // Smooth flight to new location
    const currentZoom = map.current.getZoom();
    map.current.flyTo({
      center: [targetLng, targetLat],
      zoom: Math.max(currentZoom, 14),
      pitch: 45,
      duration: 2500,
      essential: true,
      curve: 1.5,
      easing: (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
    });
  }, [locationLat, locationLng, userLat, userLng]);

  // Add/Update the 5km range indicator circle
  useEffect(() => {
    if (!map.current) return;

    const centerLat = locationLat ?? userLat;
    const centerLng = locationLng ?? userLng;
    const RANGE_RADIUS = 5000; // 5km in meters

    const addRangeCircle = () => {
      const fogMaskData = createFogOfWarMask(centerLng, centerLat, RANGE_RADIUS);
      const circleBorderData = createCircleBorder(centerLng, centerLat, RANGE_RADIUS);

      // Check if sources already exist - update them
      if (map.current?.getSource('fog-of-war')) {
        (map.current.getSource('fog-of-war') as mapboxgl.GeoJSONSource).setData(fogMaskData);
        (map.current.getSource('range-border') as mapboxgl.GeoJSONSource).setData(circleBorderData);
      } else {
        // Add fog of war mask source and layer
        map.current?.addSource('fog-of-war', {
          type: 'geojson',
          data: fogMaskData
        });

        // Fog fill covering everything EXCEPT the circle - softer opacity for adventure feel
        map.current?.addLayer({
          id: 'fog-of-war-fill',
          type: 'fill',
          source: 'fog-of-war',
          paint: {
            'fill-color': '#1a3a2a',
            'fill-opacity': 0.5
          }
        });

        // Add separate source for the border (circle only)
        map.current?.addSource('range-border', {
          type: 'geojson',
          data: circleBorderData
        });

        // Border/stroke layer on the circle edge - solid line for adventure feel
        map.current?.addLayer({
          id: 'range-circle-border',
          type: 'line',
          source: 'range-border',
          paint: {
            'line-color': 'hsl(122, 39%, 49%)', // Adventure green
            'line-width': 3,
            'line-opacity': 0.7
          }
        });
      }
    };

    // If map is already loaded, add immediately
    if (map.current.isStyleLoaded()) {
      addRangeCircle();
    } else {
      // Wait for style to load
      map.current.on('load', addRangeCircle);
    }

    return () => {
      // Cleanup is handled by map removal in the init effect
    };
  }, [locationLat, locationLng, userLat, userLng]);

  // Render user markers with connected status - INCREMENTAL UPDATE (no re-blooming)
  useEffect(() => {
    if (!map.current) return;

    // Skip if map style not ready yet - will re-run when mapStyleLoaded changes
    if (!mapStyleLoaded) return;
    
    // If showUsers is false, remove all user markers
    if (!showUsers) {
      userMarkersMapRef.current.forEach(({ marker, root }) => {
        marker.remove();
        queueMicrotask(() => {
          try { root.unmount(); } catch (e) { /* ignore */ }
        });
      });
      userMarkersMapRef.current.clear();
      return;
    }

    // Build set of current profile IDs (excluding self)
    const currentProfileIds = new Set<string>();
    filteredProfiles.forEach(profile => {
      if (profile.location_lat && profile.location_lng && profile.id !== currentUserId) {
        currentProfileIds.add(profile.id);
      }
    });

    // 1. REMOVE markers for users no longer in the data
    userMarkersMapRef.current.forEach(({ marker, root }, id) => {
      if (!currentProfileIds.has(id)) {
        marker.remove();
        queueMicrotask(() => {
          try { root.unmount(); } catch (e) { /* ignore */ }
        });
        userMarkersMapRef.current.delete(id);
      }
    });

    // 2. ADD or UPDATE markers for current profiles
    filteredProfiles.forEach(profile => {
      const profileLat = profile.location_lat;
      const profileLng = profile.location_lng;
      
      if (!profileLat || !profileLng) return;
      if (profile.id === currentUserId) return;

      const offset = getDeterministicOffset(profile.id);
      const jitteredLat = profileLat + offset.lat;
      const jitteredLng = profileLng + offset.lng;

      const isConnected = connectedUserIds.has(profile.id);
      
      // Check if this user has bounced since last render
      const lastKnownBounce = bounceTimestampsRef.current.get(profile.id);
      const currentBounce = profile.last_bounce_at;
      const shouldBounce = currentBounce && currentBounce !== lastKnownBounce;
      
      if (currentBounce) {
        bounceTimestampsRef.current.set(profile.id, currentBounce);
      }

      const existing = userMarkersMapRef.current.get(profile.id);

      if (existing) {
        // EXISTING MARKER - just update position if needed, trigger bounce if needed
        existing.marker.setLngLat([jitteredLng, jitteredLat]);
        
        // Trigger bounce animation with particles if needed
        if (shouldBounce) {
          // Re-render with particles and animation
          const bounceKey = Date.now();
          existing.root.render(
            <div 
              key={bounceKey}
              className={`user-avatar-marker animate-bounce-wave ${isConnected ? 'connected' : ''}`}
            >
              <AvatarDisplay 
                config={profile.avatar_config} 
                size={40} 
                showGlow={false}
              />
              <FloatingParticles trigger={bounceKey} />
            </div>
          );
        }
        
        // Update connected status
        const avatarDiv = existing.element.querySelector('.user-avatar-marker');
        if (avatarDiv) {
          if (isConnected) {
            avatarDiv.classList.add('connected');
          } else {
            avatarDiv.classList.remove('connected');
          }
        }
      } else {
        // NEW MARKER - create with pop-in animation
        const el = document.createElement('div');
        el.className = 'user-marker';
        el.dataset.userId = profile.id;
        el.style.zIndex = '10';
        el.style.width = '44px';
        el.style.height = '44px';
        
        const container = document.createElement('div');
        container.className = 'marker-container';
        el.appendChild(container);
        
        const randomDelay = Math.floor(Math.random() * 400);
        container.style.animationDelay = `${randomDelay}ms`;

        const root = createRoot(container);
        root.render(
          <div className={`user-avatar-marker ${isConnected ? 'connected' : ''}`}>
            <AvatarDisplay 
              config={profile.avatar_config} 
              size={40} 
              showGlow={false}
            />
          </div>
        );

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          
          // Guest login wall: block detail view for unauthenticated users
          if (isGuestRef.current) {
            setGuestPromptVariant('view');
            setGuestPromptOpen(true);
            return;
          }
          
          if (map.current) {
            map.current.flyTo({
              center: [jitteredLng, jitteredLat],
              zoom: 15,
              pitch: 45,
              duration: 1500,
              essential: true
            });
          }
          setSelectedUser(profile);
          setProfileModalOpen(true);
        });

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([jitteredLng, jitteredLat])
          .addTo(map.current!);

        userMarkersMapRef.current.set(profile.id, { marker, root, element: el });
      }
    });

  }, [filteredProfiles, currentUserId, connectedUserIds, mapStyleLoaded, showUsers]);

  // Render "My Avatar" marker at current location (skip for guests)
  // Uses incremental update pattern to avoid flickering
  useEffect(() => {
    if (!map.current) return;

    // Skip rendering for guests
    if (isGuest) {
      // Clean up if switching to guest mode
      if (myMarkerRef.current) {
        myMarkerRef.current.remove();
        myMarkerRef.current = null;
      }
      if (myMarkerRootRef.current) {
        queueMicrotask(() => {
          try { myMarkerRootRef.current?.unmount(); } catch (e) { /* ignore */ }
        });
        myMarkerRootRef.current = null;
      }
      return;
    }
    
    // Skip if map style not ready yet
    if (!mapStyleLoaded) return;

    // Use location_lat/lng from DB as the base coordinates
    const baseLat = locationLat ?? userLat;
    const baseLng = locationLng ?? userLng;

    if (!baseLat || !baseLng || !currentUserId) return;

    // CRITICAL: Apply the SAME deterministic jitter as other users see
    const offset = getDeterministicOffset(currentUserId);
    const myLat = baseLat + offset.lat;
    const myLng = baseLng + offset.lng;

    // Check if marker already exists
    if (myMarkerRef.current && myMarkerRootRef.current) {
      // EXISTING MARKER - animate to new position smoothly
      const marker = myMarkerRef.current;
      const currentPos = marker.getLngLat();
      const targetLng = myLng;
      const targetLat = myLat;
      
      // Skip animation if position hasn't changed significantly
      const distance = Math.sqrt(
        Math.pow(currentPos.lng - targetLng, 2) + 
        Math.pow(currentPos.lat - targetLat, 2)
      );
      
      if (distance < 0.00001) return; // Less than ~1m, skip
      
      // Smooth fly animation using requestAnimationFrame
      const duration = 800; // ms
      const startTime = performance.now();
      const startLng = currentPos.lng;
      const startLat = currentPos.lat;
      
      // Easing function (ease-out-cubic)
      const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
      
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeOutCubic(progress);
        
        const newLng = startLng + (targetLng - startLng) * easedProgress;
        const newLat = startLat + (targetLat - startLat) * easedProgress;
        
        marker.setLngLat([newLng, newLat]);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      requestAnimationFrame(animate);
      return;
    }

    // NEW MARKER - create only once with pop-in animation
    const el = document.createElement('div');
    el.className = `my-marker ${isGhostMode ? 'ghost-mode' : ''}`;
    el.style.width = '48px';
    el.style.height = '48px';
    el.style.zIndex = '30';
    
    const container = document.createElement('div');
    container.className = 'my-marker-container marker-pop-in';
    container.style.width = '48px';
    container.style.height = '48px';
    el.appendChild(container);
    
    const root = createRoot(container);
    myMarkerRootRef.current = root;
    
    root.render(
      <div 
        className={`my-avatar-ring ${isGhostMode ? 'ghost' : ''}`}
        title="Click to Wave!"
      >
        <AvatarDisplay 
          config={currentUserAvatarConfig} 
          size={44} 
          showGlow={false}
        />
        <FloatingParticles trigger={0} />
      </div>
    );

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      handleBounce();
    });

    const marker = new mapboxgl.Marker({ element: el })
      .setLngLat([myLng, myLat])
      .addTo(map.current!);

    myMarkerRef.current = marker;
  }, [locationLat, locationLng, userLat, userLng, currentUserId, isGuest, mapStyleLoaded]);

  // Separate effect to update avatar appearance (ghost mode, avatar config changes)
  useEffect(() => {
    if (!myMarkerRootRef.current || isGuest) return;
    
    myMarkerRootRef.current.render(
      <div 
        className={`my-avatar-ring ${isGhostMode ? 'ghost' : ''}`}
        title="Click to Wave!"
      >
        <AvatarDisplay 
          config={currentUserAvatarConfig} 
          size={44} 
          showGlow={false}
        />
        <FloatingParticles trigger={0} />
      </div>
    );
  }, [currentUserAvatarConfig, isGhostMode, isGuest]);

  // Re-render my-marker content on bounce for instant animation reset (key-based)
  useEffect(() => {
    if (!myMarkerRootRef.current || myBounceCount === 0) return;
    
    myMarkerRootRef.current.render(
      <div 
        key={myBounceCount}
        className={`my-avatar-ring animate-bounce-wave ${isGhostMode ? 'ghost' : ''}`}
        title="Click to Wave!"
      >
        <AvatarDisplay 
          config={currentUserAvatarConfig} 
          size={44} 
          showGlow={false}
        />
        <FloatingParticles trigger={particleTrigger} />
      </div>
    );
  }, [myBounceCount, particleTrigger, currentUserAvatarConfig, isGhostMode]);


  // Cleanup expired bubbles every second
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();

      setActiveBubbles((prev) => {
        let changed = false;
        const next = new Map(prev);

        next.forEach((bubble, userId) => {
          if (bubble.expiresAt >= now) return;

          next.delete(userId);
          changed = true;

          // Unmount bubble root (if any)
          const root = speechBubbleRootsRef.current.get(userId);
          if (root) {
            try {
              root.unmount();
            } catch (e) {
              // ignore
            }
            speechBubbleRootsRef.current.delete(userId);
          }

          // Remove the container element from overlay
          bubbleOverlayRef.current?.querySelector(`[data-bubble-user="${userId}"]`)?.remove();
        });

        return changed ? next : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Render speech bubbles in a separate overlay (above all markers)
  useEffect(() => {
    if (!map.current || !mapStyleLoaded || !bubbleOverlayRef.current) return;

    const mapInstance = map.current;

    activeBubbles.forEach((bubble, userId) => {
      // Find the marker to get its screen position
      const markerEntry = userMarkersMapRef.current.get(userId);
      const isMyBubble = userId === currentUserId;
      
      let markerRef: mapboxgl.Marker | null = null;
      
      if (isMyBubble && myMarkerRef.current) {
        markerRef = myMarkerRef.current;
      } else if (markerEntry) {
        markerRef = markerEntry.marker;
      }
      
      if (!markerRef) return;

      // Get marker's screen position
      const lngLat = markerRef.getLngLat();
      const point = mapInstance.project(lngLat);

      // Check if bubble container already exists in overlay
      let bubbleContainer = bubbleOverlayRef.current!.querySelector(`[data-bubble-user="${userId}"]`) as HTMLElement;

      if (!bubbleContainer) {
        bubbleContainer = document.createElement('div');
        bubbleContainer.className = 'speech-bubble-overlay-item';
        bubbleContainer.dataset.bubbleUser = userId;
        bubbleOverlayRef.current!.appendChild(bubbleContainer);
      }

      // Position the bubble centered above the marker
      // CSS class .speech-bubble-overlay-item handles transform: translateX(-50%) translateY(-100%)
      bubbleContainer.style.left = `${point.x}px`;
      bubbleContainer.style.top = `${point.y - 30}px`; // Offset above avatar

      // Ensure we always have a React root for this container
      let root = speechBubbleRootsRef.current.get(userId);
      if (!root) {
        root = createRoot(bubbleContainer);
        speechBubbleRootsRef.current.set(userId, root);
      }
      root.render(
        <div className="speech-bubble animate-bubble-pop">
          <span className="speech-bubble-text">{bubble.message}</span>
          <div className="speech-bubble-tail" />
        </div>
      );
    });

    // Remove bubbles for users no longer in activeBubbles
    speechBubbleRootsRef.current.forEach((root, userId) => {
      if (!activeBubbles.has(userId)) {
        try { root.unmount(); } catch (e) { /* ignore */ }
        speechBubbleRootsRef.current.delete(userId);
        
        // Remove container from overlay
        const container = bubbleOverlayRef.current?.querySelector(`[data-bubble-user="${userId}"]`);
        if (container) container.remove();
      }
    });
  }, [activeBubbles, mapStyleLoaded, currentUserId]);

  // Update bubble positions when map moves
  useEffect(() => {
    if (!map.current || !bubbleOverlayRef.current) return;

    const mapInstance = map.current;

    const updateBubblePositions = () => {
      if (!bubbleOverlayRef.current) return;

      activeBubbles.forEach((bubble, userId) => {
        const markerEntry = userMarkersMapRef.current.get(userId);
        const isMyBubble = userId === currentUserId;
        
        let markerRef: mapboxgl.Marker | null = null;
        
        if (isMyBubble && myMarkerRef.current) {
          markerRef = myMarkerRef.current;
        } else if (markerEntry) {
          markerRef = markerEntry.marker;
        }
        
        if (!markerRef) return;

        const lngLat = markerRef.getLngLat();
        const point = mapInstance.project(lngLat);

        const bubbleContainer = bubbleOverlayRef.current!.querySelector(`[data-bubble-user="${userId}"]`) as HTMLElement;
        if (bubbleContainer) {
          // Only update left/top - CSS class handles the centering transform
          bubbleContainer.style.left = `${point.x}px`;
          bubbleContainer.style.top = `${point.y - 30}px`;
        }
      });
    };

    mapInstance.on('move', updateBubblePositions);
    mapInstance.on('zoom', updateBubblePositions);

    return () => {
      mapInstance.off('move', updateBubblePositions);
      mapInstance.off('zoom', updateBubblePositions);
    };
  }, [activeBubbles, currentUserId]);

  // Render quest markers (public only) with dynamic activity icons - INCREMENTAL UPDATE
  useEffect(() => {
    if (!map.current) return;
    
    // Skip if map style not ready yet
    if (!mapStyleLoaded) return;

    // Build set of current quest IDs
    const currentQuestIds = new Set(filteredQuests.map(q => q.id));

    // 1. REMOVE markers for quests no longer in the data
    questMarkersMapRef.current.forEach((marker, id) => {
      if (!currentQuestIds.has(id)) {
        marker.remove();
        questMarkersMapRef.current.delete(id);
      }
    });

    // 2. ADD new markers (only for quests not already on map)
    filteredQuests.forEach(quest => {
      if (questMarkersMapRef.current.has(quest.id)) {
        // Already exists - just update position if needed
        const existing = questMarkersMapRef.current.get(quest.id)!;
        existing.setLngLat([quest.lng, quest.lat]);
        return;
      }
      
      // NEW QUEST - create with pop-in animation
      const activityIcon = getActivityIcon(quest.category);
      const categoryColor = getCategoryColor(quest.category);
      const isMyQuest = quest.host_id === currentUserId || joinedQuestIds.has(quest.id);
      
      const now = Date.now();
      const startTime = new Date(quest.start_time).getTime();
      const endTime = startTime + (quest.duration_minutes * 60 * 1000);
      const isLiveNow = startTime <= now && endTime >= now;

      const el = document.createElement('div');
      el.className = `quest-marker ${isMyQuest ? 'my-quest' : ''} ${isLiveNow ? 'live-now' : ''}`;
      el.style.zIndex = '20';
      el.style.display = 'flex';
      el.style.flexDirection = 'column';
      el.style.alignItems = 'center';

      const container = document.createElement('div');
      container.className = 'quest-container marker-pop-in';
      container.style.setProperty('--category-color', categoryColor);
      
      const randomDelay = Math.floor(Math.random() * 400);
      container.style.animationDelay = `${randomDelay}ms`;

      if (isLiveNow) {
        const pulse = document.createElement('div');
        pulse.className = 'live-pulse';
        container.appendChild(pulse);
      }

      const iconDiv = document.createElement('div');
      iconDiv.className = `quest-icon ${isMyQuest ? 'my-quest-icon' : ''} ${isLiveNow ? 'live-icon' : ''}`;
      iconDiv.textContent = activityIcon;
      container.appendChild(iconDiv);

      el.appendChild(container);

      // Add title label below the icon
      const titleLabel = document.createElement('div');
      titleLabel.className = 'quest-title-label';
      titleLabel.textContent = quest.title.length > 18 ? quest.title.substring(0, 18) + '...' : quest.title;
      el.appendChild(titleLabel);

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Guest login wall: block detail view for unauthenticated users
        if (isGuestRef.current) {
          setGuestPromptVariant('view');
          setGuestPromptOpen(true);
          return;
        }
        
        if (map.current) {
          map.current.flyTo({
            center: [quest.lng, quest.lat],
            zoom: 15,
            pitch: 45,
            duration: 1500,
            essential: true
          });
        }
        setSelectedQuest(quest);
        setLobbyOpen(true);
      });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([quest.lng, quest.lat])
        .addTo(map.current!);

      questMarkersMapRef.current.set(quest.id, marker);
    });
    
  }, [filteredQuests, currentUserId, joinedQuestIds, mapStyleLoaded]);

  // Render shout markers on map
  useEffect(() => {
    if (!map.current || !mapStyleLoaded) return;

    const currentShoutIds = new Set(shouts.map(s => s.id));

    // 1. REMOVE markers for shouts no longer in the data
    shoutMarkersMapRef.current.forEach(({ marker, root }, id) => {
      if (!currentShoutIds.has(id)) {
        marker.remove();
        queueMicrotask(() => {
          try { root.unmount(); } catch (e) { /* ignore */ }
        });
        shoutMarkersMapRef.current.delete(id);
      }
    });

    // 2. ADD or UPDATE markers
    shouts.forEach(shout => {
      const counts = getShoutCounts(shout.id);
      
      // Create a click handler for this shout
      const handleShoutClick = () => {
        // Guest login wall: block detail view for unauthenticated users
        if (isGuestRef.current) {
          setGuestPromptVariant('view');
          setGuestPromptOpen(true);
          return;
        }
        
        setSelectedShout({
          id: shout.id,
          user_id: shout.user_id,
          content: shout.content,
          lat: shout.lat,
          lng: shout.lng,
          created_at: shout.created_at,
        });
        setShoutDetailsOpen(true);
      };

      // Create a hide handler for this shout
      const handleHideShout = async () => {
        const success = await hideShout(shout.id);
        if (success) {
          // Remove the marker immediately from the map
          const existing = shoutMarkersMapRef.current.get(shout.id);
          if (existing) {
            existing.marker.remove();
            queueMicrotask(() => {
              try { existing.root.unmount(); } catch (e) { /* ignore */ }
            });
            shoutMarkersMapRef.current.delete(shout.id);
          }
        }
      };

      // Can hide if logged in and not the shout owner
      const canHide = !!currentUserId && shout.user_id !== currentUserId;
      const isOwn = !!currentUserId && shout.user_id === currentUserId;
      
      if (shoutMarkersMapRef.current.has(shout.id)) {
        // Already exists - update position and re-render with new counts
        const existing = shoutMarkersMapRef.current.get(shout.id)!;
        existing.marker.setLngLat([shout.lng, shout.lat]);
        existing.root.render(
          <ShoutMarker
            content={shout.content}
            createdAt={shout.created_at}
            likesCount={counts.likesCount}
            commentsCount={counts.commentsCount}
            onClick={handleShoutClick}
            onHide={handleHideShout}
            canHide={canHide}
            isOwn={isOwn}
            isGuest={isGuest}
          />
        );
        return;
      }

      // Create new marker element
      const el = document.createElement('div');
      el.className = 'shout-marker-container';
      
      const root = createRoot(el);
      root.render(
        <ShoutMarker
          content={shout.content}
          createdAt={shout.created_at}
          likesCount={counts.likesCount}
          commentsCount={counts.commentsCount}
          onClick={handleShoutClick}
          onHide={handleHideShout}
          canHide={canHide}
          isOwn={isOwn}
          isGuest={isGuest}
        />
      );

      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([shout.lng, shout.lat])
        .addTo(map.current!);

      shoutMarkersMapRef.current.set(shout.id, { marker, root });
    });
    
  }, [shouts, mapStyleLoaded, getShoutCounts, hideShout, currentUserId, isGuest]);

  // Cleanup markers/React roots on unmount only (prevents re-blooming on data refresh)
  useEffect(() => {
    return () => {
      // User markers
      userMarkersMapRef.current.forEach(({ marker, root }) => {
        marker.remove();
        queueMicrotask(() => {
          try { root.unmount(); } catch (e) { /* ignore */ }
        });
      });
      userMarkersMapRef.current.clear();

      // Quest markers
      questMarkersMapRef.current.forEach(marker => marker.remove());
      questMarkersMapRef.current.clear();

      // Shout markers
      shoutMarkersMapRef.current.forEach(({ marker, root }) => {
        marker.remove();
        queueMicrotask(() => {
          try { root.unmount(); } catch (e) { /* ignore */ }
        });
      });
      shoutMarkersMapRef.current.clear();

      // My marker root
      myMarkerRef.current?.remove();
      myMarkerRef.current = null;
      const myRoot = myMarkerRootRef.current;
      myMarkerRootRef.current = null;
      if (myRoot) {
        queueMicrotask(() => {
          try { myRoot.unmount(); } catch (e) { /* ignore */ }
        });
      }
    };
  }, []);

  // Helper function to close the user profile modal
  const closeUserProfile = useCallback(() => {
    setSelectedUser(null);
    setProfileModalOpen(false);
  }, []);

  const isTokenMissing = !MAPBOX_TOKEN || MAPBOX_TOKEN === 'YOUR_MAPBOX_TOKEN_HERE';

  return (
    <>
      <style>{`
        /* Marker pop-in animation
           IMPORTANT: Mapbox positions markers using a transform on the marker root.
           If we animate transform on the root, markers get pinned to (0,0).
           So we only animate the INNER containers.
        */
        @keyframes marker-pop-in {
          0% {
            opacity: 0;
            transform: scale(0.6);
          }
          70% {
            opacity: 1;
            transform: scale(1.08);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        .user-marker {
          cursor: pointer !important;
          overflow: visible !important;
          pointer-events: auto !important;
        }
        .marker-container {
          position: relative;
          width: 44px;
          height: 44px;
          overflow: visible;
          animation: marker-pop-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          will-change: transform, opacity;
          transition: transform 0.2s ease-out !important;
          transform-origin: center center !important;
          pointer-events: auto !important;
        }
        .user-marker:hover .marker-container {
          transform: scale(1.08) !important;
        }
        /* Adventure style for user avatars */
        .user-avatar-marker {
          width: 44px;
          height: 44px;
          pointer-events: auto !important;
        }
        /* Connected user - same clean look */
        .user-avatar-marker.connected {
          /* no extra styling */
        }
        .my-marker {
          cursor: pointer;
        }
        .my-marker-container {
          position: relative;
          width: 48px;
          height: 48px;
          animation: marker-pop-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          will-change: transform, opacity;
          transition: transform 0.2s ease-out;
        }
        .my-marker:hover .my-marker-container {
          transform: scale(1.08);
        }
        /* Current user marker - clean, no extra ring */
        .my-avatar-ring {
          width: 48px;
          height: 48px;
          transition: all 0.2s ease-out;
        }
        .my-avatar-ring.ghost {
          opacity: 0.5;
          filter: grayscale(100%);
        }
        .my-marker.ghost-mode {
          opacity: 0.6;
        }
        .quest-marker {
          cursor: pointer;
        }
        .quest-container {
          position: relative;
          width: 56px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: marker-pop-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          will-change: transform, opacity;
        }
        .quest-icon {
          position: relative;
          z-index: 1;
          width: 56px;
          height: 56px;
          border-radius: 16px;
          background: hsl(var(--card) / 0.9);
          backdrop-filter: blur(12px);
          border: 1px solid hsl(var(--primary) / 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 36px;
          line-height: 1;
          box-shadow: 0 0 8px hsl(var(--primary) / 0.15);
          transition: all 0.2s ease-out;
        }
        .quest-icon.my-quest-icon {
          border: 3px solid hsl(var(--primary));
          box-shadow: 0 0 16px hsl(var(--primary) / 0.5), inset 0 0 8px hsl(var(--primary) / 0.1);
        }
        /* Live Now green glow effect */
        .live-pulse {
          position: absolute;
          inset: -6px;
          border-radius: 18px;
          background: transparent;
          border: 2px solid #22c55e;
          box-shadow: 0 0 20px rgba(34, 197, 94, 0.6), 0 0 40px rgba(34, 197, 94, 0.3);
          animation: live-pulse-glow 2s ease-in-out infinite;
          z-index: 0;
        }
        @keyframes live-pulse-glow {
          0%, 100% {
            opacity: 0.6;
            transform: scale(1);
            box-shadow: 0 0 20px rgba(34, 197, 94, 0.6), 0 0 40px rgba(34, 197, 94, 0.3);
          }
          50% {
            opacity: 1;
            transform: scale(1.05);
            box-shadow: 0 0 30px rgba(34, 197, 94, 0.8), 0 0 60px rgba(34, 197, 94, 0.4);
          }
        }
        .quest-icon.live-icon {
          box-shadow: 0 0 12px rgba(34, 197, 94, 0.4);
        }
        /* Combined: My Quest + Live Now */
        .quest-icon.my-quest-icon.live-icon {
          border: 3px solid hsl(var(--primary));
          box-shadow: 0 0 16px hsl(var(--primary) / 0.5), 0 0 24px rgba(34, 197, 94, 0.4), inset 0 0 8px hsl(var(--primary) / 0.1);
        }
        .quest-marker:hover .quest-icon {
          transform: scale(1.08);
          /* Keep background SOLID - no opacity change */
          border-color: hsl(var(--primary));
          box-shadow: 0 0 16px hsl(var(--primary) / 0.4);
        }
        .quest-marker.my-quest:hover .quest-icon {
          box-shadow: 0 0 20px hsl(var(--primary) / 0.6), inset 0 0 10px hsl(var(--primary) / 0.15);
        }
        .quest-marker.live-now:hover .live-pulse {
          animation-play-state: paused;
          opacity: 1;
          transform: scale(1.08);
        }
        .quest-marker:active .quest-icon {
          transform: scale(1.04);
        }
        /* Quest title label */
        .quest-title-label {
          margin-top: 4px;
          padding: 2px 8px;
          background: hsl(var(--card) / 0.95);
          border: 1px solid hsl(var(--border));
          border-radius: 9999px;
          font-size: 10px;
          font-weight: 600;
          color: hsl(var(--foreground));
          white-space: nowrap;
          max-width: 100px;
          overflow: hidden;
          text-overflow: ellipsis;
          text-align: center;
          box-shadow: 0 1px 3px hsl(var(--foreground) / 0.1);
          backdrop-filter: blur(4px);
        }
        /* Speech bubble overlay item - positioned absolutely in the overlay */
        .speech-bubble-overlay-item {
          position: absolute;
          transform: translateX(-50%) translateY(-100%);
          pointer-events: none;
          display: flex;
          justify-content: center;
        }
        .speech-bubble {
          position: relative;
          background: hsl(var(--card));
          backdrop-filter: blur(12px);
          border: 2px solid hsl(var(--primary) / 0.6);
          border-radius: 14px;
          padding: 8px 14px;
          width: fit-content;
          min-width: 40px;
          max-width: 220px;
          box-shadow: 
            0 4px 16px hsl(var(--primary) / 0.25), 
            0 0 24px hsl(var(--primary) / 0.15),
            0 2px 4px rgba(0, 0, 0, 0.15);
        }
        .speech-bubble-text {
          font-family: var(--font-nunito), sans-serif;
          font-size: 14px;
          font-weight: 600;
          color: hsl(var(--foreground));
          line-height: 1.45;
          white-space: pre-wrap;
          word-wrap: break-word;
          overflow-wrap: break-word;
          hyphens: auto;
          text-align: center;
          display: block;
        }
        .speech-bubble-tail {
          position: absolute;
          bottom: -8px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 8px solid transparent;
          border-right: 8px solid transparent;
          border-top: 8px solid hsl(var(--primary) / 0.6);
        }
        .speech-bubble-tail::before {
          content: '';
          position: absolute;
          bottom: 2px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 6px solid hsl(var(--card));
        }
        @keyframes bubble-pop {
          0% {
            opacity: 0;
            transform: scale(0.5);
          }
          50% {
            transform: scale(1.05);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-bubble-pop {
          animation: bubble-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
      `}</style>
      
      
      <div 
        ref={mapContainer} 
        className={`absolute inset-0 ${isGuest ? 'guest-spawn-cursor' : ''}`} 
      />

      {/* Speech bubble overlay - sits above all markers */}
      <div 
        ref={bubbleOverlayRef}
        className="absolute inset-0 pointer-events-none z-[35] overflow-hidden"
      />

      {/* Guest spawn tooltip */}
      <GuestSpawnTooltip 
        mapContainer={mapContainer.current} 
        isVisible={isGuest} 
      />

      {/* Subtle loading indicator - top right corner */}
      {isDataLoading && (
        <div className="absolute top-4 right-4 z-30 flex items-center gap-2 px-3 py-2 bg-card/90 backdrop-blur-md border border-border rounded-lg shadow-hard animate-fade-in">
          <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="font-nunito text-xs text-muted-foreground">Scanning area...</span>
        </div>
      )}

      {/* Bubble Chat Input - only for logged-in users */}
      <BubbleChat
        currentUserId={currentUserId}
        isGuest={isGuest}
        onLocalBubble={handleLocalBubble}
        onSendMessage={sendChatMessage}
      />

      {/* Custom Map Controls - Vertically centered on right edge */}
      {!isTokenMissing && (
        <div className="absolute top-1/2 -translate-y-1/2 right-4 z-20 flex flex-col gap-2">
          {/* Center on Base Button - hide for guests */}
          {!isGuest && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                if (map.current) {
                  map.current.flyTo({
                    center: [baseLng, baseLat],
                    zoom: 14,
                    duration: 1500,
                  });
                }
              }}
              className="w-11 h-11 bg-card/90 backdrop-blur-md border-primary/30 hover:bg-primary/20 hover:border-primary"
              title="Center on My Location"
            >
              <Crosshair className="w-5 h-5 text-primary" />
            </Button>
          )}

          {/* Zoom In */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              if (map.current) {
                map.current.zoomIn({ duration: 300 });
              }
            }}
            className="w-11 h-11 bg-card/90 backdrop-blur-md border-border/50 hover:bg-muted"
            title="Zoom In"
          >
            <Plus className="w-5 h-5" />
          </Button>

          {/* Zoom Out */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              if (map.current) {
                map.current.zoomOut({ duration: 300 });
              }
            }}
            className="w-11 h-11 bg-card/90 backdrop-blur-md border-border/50 hover:bg-muted"
            title="Zoom Out"
          >
            <Minus className="w-5 h-5" />
          </Button>

          {/* Compass / View Toggle */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              if (map.current) {
                if (isTacticalView) {
                  // Switch to Flat view
                  map.current.easeTo({
                    pitch: 0,
                    bearing: 0,
                    duration: 500,
                  });
                  setIsTacticalView(false);
                } else {
                  // Switch to Tactical view
                  map.current.easeTo({
                    pitch: 60,
                    bearing: 0,
                    duration: 500,
                  });
                  setIsTacticalView(true);
                }
              }
            }}
            className={`w-11 h-11 bg-card/90 backdrop-blur-md border-border/50 hover:bg-muted transition-transform ${
              isTacticalView ? 'rotate-0' : 'rotate-45'
            }`}
            title={isTacticalView ? 'Switch to Flat View' : 'Switch to Tactical View'}
          >
            <Compass className={`w-5 h-5 transition-colors ${isTacticalView ? 'text-accent' : 'text-muted-foreground'}`} />
          </Button>

          {/* Toggle Users Visibility */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowUsers(prev => !prev)}
            className={`w-11 h-11 backdrop-blur-md border-border/50 transition-all ${
              showUsers 
                ? 'bg-card/90 hover:bg-primary/20 hover:border-primary' 
                : 'bg-muted/60 hover:bg-muted/80'
            }`}
            title={showUsers ? 'Hide Users' : 'Show Users'}
          >
            {showUsers ? (
              <Users className="w-5 h-5 text-primary" />
            ) : (
              <UsersRound className="w-5 h-5 text-muted-foreground opacity-50" />
            )}
          </Button>

          {/* Ghost Mode Toggle - only for logged-in users */}
          {currentUserId && !isGuest && onGhostModeChange && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => onGhostModeChange(!isGhostMode)}
              className={`w-11 h-11 backdrop-blur-md border-border/50 transition-all ${
                isGhostMode
                  ? 'bg-muted/80 hover:bg-muted border-muted-foreground/50'
                  : 'bg-card/90 hover:bg-primary/20 hover:border-primary'
              }`}
              title={isGhostMode ? 'You are hidden (Ghost Mode)' : 'You are visible to others'}
            >
              {isGhostMode ? (
                <Ghost className="w-5 h-5 text-muted-foreground" />
              ) : (
                <Eye className="w-5 h-5 text-primary" />
              )}
            </Button>
          )}
        </div>
      )}
      
      {isTokenMissing && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="text-center p-6 rounded-2xl border-3 border-destructive/50 bg-card shadow-hard max-w-md">
            <h3 className="font-fredoka text-lg font-bold text-destructive mb-2">
              Map Token Required
            </h3>
            <p className="text-muted-foreground text-sm font-nunito">
              Please configure your Mapbox token in the .env file.
            </p>
          </div>
        </div>
      )}
      
      {/* User popup is now rendered via Mapbox Popup in useEffect above */}

      {/* Context Menu for logged-in users */}
      {currentUserId && contextMenuCoords && contextMenuScreenPos && (
        <MapContextMenu
          coords={contextMenuCoords}
          screenPosition={contextMenuScreenPos}
          currentUserId={currentUserId}
          onClose={() => {
            setContextMenuCoords(null);
            setContextMenuScreenPos(null);
          }}
          onMoveComplete={(lat, lng) => {
            // Smooth drone-like flight to the new location
            if (map.current) {
              const currentZoom = map.current.getZoom();
              map.current.flyTo({
                center: [lng, lat],
                zoom: Math.max(currentZoom, 14),
                pitch: 45,
                duration: 2500,
                essential: true,
                curve: 1.5,
                easing: (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
              });
            }
            // Notify parent to update location state - triggers data refetch
            onLocationUpdated?.(lat, lng);
          }}
          onAddEvent={(lat, lng) => {
            setClickedCoords({ lat, lng });
            setDeployModalOpen(true);
          }}
          onAddShout={(lat, lng) => {
            setShoutCoords({ lat, lng });
            setShoutModalOpen(true);
          }}
        />
      )}

      {/* Only render deploy modal for logged-in users */}
      {currentUserId && (
        <DeployQuestModal
          open={deployModalOpen}
          onOpenChange={setDeployModalOpen}
          coordinates={clickedCoords}
          userId={currentUserId}
          userBaseLat={locationLat ?? userLat}
          userBaseLng={locationLng ?? userLng}
          onSuccess={(newQuest) => {
            setQuests(prev => [...prev, newQuest]);
          }}
        />
      )}

      {/* Shout Modal - for logged-in users */}
      {currentUserId && shoutCoords && (
        <ShoutModal
          isOpen={shoutModalOpen}
          onClose={() => {
            setShoutModalOpen(false);
            setShoutCoords(null);
          }}
          coords={shoutCoords}
          userId={currentUserId}
          onShoutCreated={refetchShouts}
        />
      )}

      {/* Shout Details Drawer - for viewing shout with comments/likes */}
      <ShoutDetailsDrawer
        isOpen={shoutDetailsOpen}
        onClose={() => {
          setShoutDetailsOpen(false);
          setSelectedShout(null);
        }}
        shout={selectedShout}
        currentUserId={currentUserId}
      />

      {/* Guest Prompt Modal - for any user */}
      <GuestPromptModal
        open={guestPromptOpen}
        onOpenChange={setGuestPromptOpen}
        variant={guestPromptVariant}
      />

      {/* Quest Lobby - allow guests to view (restrictions inside) */}
      <QuestLobby
        open={lobbyOpen}
        onOpenChange={setLobbyOpen}
        quest={selectedQuest}
        currentUserId={currentUserId}
        onDelete={fetchQuests}
        onJoin={(questId) => {
          setJoinedQuestIds(prev => new Set([...prev, questId]));
        }}
        onLeave={(questId) => {
          setJoinedQuestIds(prev => {
            const next = new Set(prev);
            next.delete(questId);
            return next;
          });
        }}
        onUpdate={(updatedQuest) => {
          setQuests(prev => prev.map(q => q.id === updatedQuest.id ? updatedQuest : q));
          setSelectedQuest(updatedQuest);
        }}
        onViewUserProfile={(user) => {
          const userLat = user.location_lat;
          const userLng = user.location_lng;
          if (userLat && userLng) {
            flyTo(userLat, userLng);
            setTimeout(() => {
              setSelectedUser({
                id: user.id,
                nick: user.nick,
                avatar_url: user.avatar_url,
                avatar_config: user.avatar_config,
                tags: user.tags,
                bio: user.bio,
                location_lat: user.location_lat,
                location_lng: user.location_lng,
                is_active: true,
              });
              setProfileModalOpen(true);
            }, 300);
          }
        }}
        isUserInViewport={(lat, lng) => {
          if (!map.current) return true;
          const bounds = map.current.getBounds();
          return bounds.contains([lng, lat]);
        }}
      />

      {/* User Profile Modal - unified modal for map and connections */}
      <ProfileModal
        open={profileModalOpen}
        onOpenChange={(open) => {
          setProfileModalOpen(open);
          if (!open) setSelectedUser(null);
        }}
        user={selectedUser}
        currentUserId={currentUserId}
        isConnected={selectedUser ? connectedUserIds.has(selectedUser.id) : false}
        invitationId={selectedUser ? getInvitationIdForUser(selectedUser.id) : undefined}
        viewportBounds={null}
        onOpenChat={onOpenChatWithUser}
        onDisconnect={refetchConnections}
        onCloseChat={onCloseChat}
        onNavigate={navigate}
        onFlyTo={flyTo}
      />
    </>
  );
});

TacticalMap.displayName = 'TacticalMap';

export default TacticalMap;
