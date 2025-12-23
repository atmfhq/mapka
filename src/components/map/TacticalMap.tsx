import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { createRoot, Root } from 'react-dom/client';
import { supabase } from '@/integrations/supabase/client';
import UserPopupContent from './UserPopupContent';
import DeployQuestModal from './DeployQuestModal';
import QuestLobby from './QuestLobby';
import GuestPromptModal from './GuestPromptModal';
import GuestSpawnTooltip from './GuestSpawnTooltip';
import MapContextMenu from './MapContextMenu';
import AvatarDisplay from '@/components/avatar/AvatarDisplay';
import { Json } from '@/integrations/supabase/types';
import { ACTIVITIES, getCategoryForActivity, getActivityById } from '@/constants/activities';
import { useConnectedUsers } from '@/hooks/useConnectedUsers';
import { Button } from '@/components/ui/button';
import { Crosshair, Plus, Minus, Compass, Users, UsersRound } from 'lucide-react';

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
}

export type DateFilter = 'today' | '3days' | '7days';

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
  isGuest?: boolean;
  onOpenChatWithUser?: (userId: string) => void;
  onCloseChat?: () => void;
  onLocationUpdated?: (lat: number, lng: number) => void;
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
// Returns offsets of roughly +/- 400m (approx +/- 0.004 degrees)
const getDeterministicOffset = (id: string): { lat: number; lng: number } => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  // Normalize to range -0.004 to +0.004 (approx 400m)
  const latOffset = ((hash % 1000) / 1000) * 0.008 - 0.004;
  const lngOffset = (((hash >> 8) % 1000) / 1000) * 0.008 - 0.004;
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
  isGuest = false,
  onOpenChatWithUser,
  onCloseChat,
  onLocationUpdated
}, ref) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  // Use Maps keyed by ID for incremental marker updates (no re-blooming)
  const userMarkersMapRef = useRef<Map<string, { marker: mapboxgl.Marker; root: Root; element: HTMLDivElement }>>(new Map());
  const questMarkersMapRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const myMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const myMarkerRootRef = useRef<Root | null>(null);
  
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [joinedQuestIds, setJoinedQuestIds] = useState<Set<string>>(new Set());
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [selectedUserCoords, setSelectedUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const userPopupRef = useRef<mapboxgl.Popup | null>(null);
  const userPopupRootRef = useRef<Root | null>(null);
  
  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const [guestPromptOpen, setGuestPromptOpen] = useState(false);
  const [guestPromptVariant, setGuestPromptVariant] = useState<'join' | 'connect' | 'create'>('create');
  const [clickedCoords, setClickedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [contextMenuCoords, setContextMenuCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [contextMenuScreenPos, setContextMenuScreenPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
  const [lobbyOpen, setLobbyOpen] = useState(false);
  const [isTacticalView, setIsTacticalView] = useState(true);
  const [mapStyleLoaded, setMapStyleLoaded] = useState(false); // Track when style is ready for markers
  const [lastBounceTime, setLastBounceTime] = useState<number>(0); // Cooldown for bounce action
  const bounceTimestampsRef = useRef<Map<string, string>>(new Map()); // Track last bounce timestamps per user
  const [showUsers, setShowUsers] = useState(true); // Toggle visibility of user avatars on map
  
  const navigate = useNavigate();

  // Get connected users (skip for guests)
  const { connectedUserIds, getInvitationIdForUser, refetch: refetchConnections } = useConnectedUsers(currentUserId ?? '');

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

  // Handle bounce/wave action with cooldown (2 seconds)
  const handleBounce = useCallback(async () => {
    if (!currentUserId || isGuest) return;
    
    const now = Date.now();
    const COOLDOWN_MS = 2000; // 2 second cooldown
    
    if (now - lastBounceTime < COOLDOWN_MS) {
      console.log('Bounce on cooldown');
      return;
    }
    
    setLastBounceTime(now);
    
    // Trigger local animation immediately
    const myMarkerEl = myMarkerRef.current?.getElement();
    const avatarRing = myMarkerEl?.querySelector('.my-avatar-ring');
    if (avatarRing) {
      avatarRing.classList.add('animate-bounce-wave');
      setTimeout(() => {
        avatarRing.classList.remove('animate-bounce-wave');
      }, 700);
    }
    
    // Update database
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ last_bounce_at: new Date().toISOString() })
        .eq('id', currentUserId);
      
      if (error) {
        console.error('Error updating bounce timestamp:', error);
      }
    } catch (err) {
      console.error('Failed to trigger bounce:', err);
    }
  }, [currentUserId, isGuest, lastBounceTime]);

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

  // Fetch nearby quests using spatial RPC
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

  // Realtime subscription for profile location updates
  useEffect(() => {
    console.log('Setting up profiles realtime subscription...');
    
    const channel = supabase
      .channel('profiles-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
        },
        (payload) => {
          console.log('🔔 Realtime: Profile updated:', payload.new);
          const updatedProfile = payload.new as Profile;
          
          // Update the profile in state if it has valid coordinates
          const hasLocation = updatedProfile.location_lat !== null && updatedProfile.location_lng !== null;
          
          if (hasLocation) {
            setProfiles(prev => {
              const exists = prev.some(p => p.id === updatedProfile.id);
              if (exists) {
                return prev.map(p => 
                  p.id === updatedProfile.id 
                    ? { ...p, ...updatedProfile, avatar_config: updatedProfile.avatar_config as AvatarConfig | null }
                    : p
                );
              } else {
                // New user with coordinates, add them
                return [...prev, { ...updatedProfile, avatar_config: updatedProfile.avatar_config as AvatarConfig | null }];
              }
            });
          } else {
            // User no longer has coordinates, remove them
            setProfiles(prev => prev.filter(p => p.id !== updatedProfile.id));
          }
        }
      )
      .subscribe((status) => {
        console.log('Profiles realtime subscription status:', status);
      });

    return () => {
      console.log('Cleaning up profiles realtime subscription');
      supabase.removeChannel(channel);
    };
  }, []);

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
      });

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
        setSelectedUserCoords(null);
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
        
        // Trigger bounce animation if needed
        if (shouldBounce) {
          const avatarDiv = existing.element.querySelector('.user-avatar-marker');
          if (avatarDiv) {
            avatarDiv.classList.remove('animate-bounce-wave');
            // Force reflow to restart animation
            void (avatarDiv as HTMLElement).offsetWidth;
            avatarDiv.classList.add('animate-bounce-wave');
            // Remove class after animation completes
            setTimeout(() => {
              avatarDiv.classList.remove('animate-bounce-wave');
            }, 700);
          }
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
        
        const root = createRoot(container);
        root.render(
          <div 
            className={`user-avatar-marker marker-pop-in ${isConnected ? 'connected' : ''}`}
            style={{ animationDelay: `${randomDelay}ms` }}
          >
            <AvatarDisplay 
              config={profile.avatar_config} 
              size={40} 
              showGlow={false}
            />
          </div>
        );

        el.addEventListener('click', (e) => {
          e.stopPropagation();
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
          setSelectedUserCoords({ lat: jitteredLat, lng: jitteredLng });
        });

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([jitteredLng, jitteredLat])
          .addTo(map.current!);

        userMarkersMapRef.current.set(profile.id, { marker, root, element: el });
      }
    });

  }, [filteredProfiles, currentUserId, connectedUserIds, mapStyleLoaded, showUsers]);

  // Render "My Avatar" marker at current location (skip for guests)
  useEffect(() => {
    if (!map.current) return;

    // Clean up previous marker - defer root unmount
    const oldRoot = myMarkerRootRef.current;
    const oldMarker = myMarkerRef.current;
    
    myMarkerRootRef.current = null;
    myMarkerRef.current = null;
    
    if (oldMarker) oldMarker.remove();
    if (oldRoot) {
      queueMicrotask(() => {
        try {
          oldRoot.unmount();
        } catch (e) {
          // Ignore
        }
      });
    }

    // Skip rendering for guests
    if (isGuest) return;
    
    // Skip if map style not ready yet
    if (!mapStyleLoaded) return;

    // Use location_lat/lng
    const myLat = locationLat ?? userLat;
    const myLng = locationLng ?? userLng;

    if (!myLat || !myLng) return;

    const el = document.createElement('div');
    el.className = `my-marker ${isGhostMode ? 'ghost-mode' : ''}`;
    el.style.width = '48px';
    el.style.height = '48px';
    el.style.zIndex = '30'; // Higher than other markers (user: 10, quest: 20)
    
    const container = document.createElement('div');
    container.className = 'my-marker-container';
    container.style.width = '48px';
    container.style.height = '48px';
    el.appendChild(container);
    
    const root = createRoot(container);
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
      </div>
    );
    myMarkerRootRef.current = root;

    // Add click handler for bounce interaction
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      handleBounce();
    });

    const marker = new mapboxgl.Marker({ element: el })
      .setLngLat([myLng, myLat])
      .addTo(map.current!);

    myMarkerRef.current = marker;

    return () => {
      const rootToClean = myMarkerRootRef.current;
      if (rootToClean) {
        queueMicrotask(() => {
          try {
            rootToClean.unmount();
          } catch (e) {
            // Ignore
          }
        });
      }
    };
  }, [locationLat, locationLng, userLat, userLng, currentUserAvatarConfig, isGhostMode, isGuest, mapStyleLoaded, handleBounce]);

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
      el.style.width = '56px';
      el.style.height = '56px';

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

      el.addEventListener('click', (e) => {
        e.stopPropagation();
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

      // Popup root
      const popupToRemove = userPopupRef.current;
      const popupRoot = userPopupRootRef.current;
      userPopupRef.current = null;
      userPopupRootRef.current = null;
      queueMicrotask(() => {
        popupToRemove?.remove();
        popupRoot?.unmount();
      });
    };
  }, []);

  // Helper function to close the user popup
  const closeUserPopup = useCallback(() => {

    if (userPopupRef.current) {
      userPopupRef.current.remove();
      userPopupRef.current = null;
    }
    if (userPopupRootRef.current) {
      userPopupRootRef.current.unmount();
      userPopupRootRef.current = null;
    }
    setSelectedUser(null);
    setSelectedUserCoords(null);
  }, []);

  // Manage Mapbox Popup for user profile - anchored to geo coordinates
  useEffect(() => {
    if (!map.current || !selectedUser || !selectedUserCoords) {
      // Clean up if no user selected
      if (userPopupRef.current) {
        userPopupRef.current.remove();
        userPopupRef.current = null;
      }
      if (userPopupRootRef.current) {
        userPopupRootRef.current.unmount();
        userPopupRootRef.current = null;
      }
      return;
    }

    // Clean up previous popup
    if (userPopupRef.current) {
      userPopupRef.current.remove();
    }
    if (userPopupRootRef.current) {
      userPopupRootRef.current.unmount();
    }

    // Create container for React content
    const container = document.createElement('div');
    container.className = 'user-popup-container';

    // Render React content into container
    const root = createRoot(container);
    userPopupRootRef.current = root;
    
    const isConnected = connectedUserIds.has(selectedUser.id);
    const invitationId = getInvitationIdForUser(selectedUser.id);

    root.render(
      <UserPopupContent
        user={selectedUser}
        currentUserId={currentUserId}
        isConnected={isConnected}
        invitationId={invitationId}
        onClose={closeUserPopup}
        onOpenChat={onOpenChatWithUser}
        onDisconnect={refetchConnections}
        onCloseChat={onCloseChat}
        onNavigate={navigate}
      />
    );

    // Create Mapbox Popup anchored to geo coordinates
    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      anchor: 'bottom',
      offset: [0, -20], // Offset above the avatar
      className: 'user-profile-popup',
      maxWidth: 'none',
    })
      .setLngLat([selectedUserCoords.lng, selectedUserCoords.lat])
      .setDOMContent(container)
      .addTo(map.current);

    userPopupRef.current = popup;

    return () => {
      // Defer cleanup to avoid unmounting during render
      const popupToRemove = userPopupRef.current;
      const rootToUnmount = userPopupRootRef.current;
      userPopupRef.current = null;
      userPopupRootRef.current = null;
      
      queueMicrotask(() => {
        popupToRemove?.remove();
        rootToUnmount?.unmount();
      });
    };
  }, [selectedUser, selectedUserCoords, currentUserId, connectedUserIds, getInvitationIdForUser, onOpenChatWithUser, refetchConnections, onCloseChat, closeUserPopup]);

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
          cursor: pointer;
        }
        .marker-container {
          position: relative;
          width: 44px;
          height: 44px;
          animation: marker-pop-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          will-change: transform, opacity;
        }
        /* Adventure style for user avatars - consistent hover with quests */
        .user-avatar-marker {
          width: 44px;
          height: 44px;
          transition: transform 0.2s ease;
          transform-origin: center center;
        }
        .user-avatar-marker:hover {
          transform: scale(1.15);
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
        }
        /* Current user marker - clean, no extra ring */
        .my-avatar-ring {
          width: 48px;
          height: 48px;
          transition: all 0.3s ease;
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
        /* Mapbox Popup custom styles for user profile */
        .user-profile-popup {
          z-index: 50 !important;
        }
        .user-profile-popup .mapboxgl-popup-content {
          background: transparent !important;
          box-shadow: none !important;
          padding: 0 !important;
          border-radius: 0 !important;
        }
        .user-profile-popup .mapboxgl-popup-tip {
          display: none !important;
        }
        .user-popup-container {
          animation: popup-enter 0.2s ease-out;
        }
        @keyframes popup-enter {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
      
      
      <div 
        ref={mapContainer} 
        className={`absolute inset-0 ${isGuest ? 'guest-spawn-cursor' : ''}`} 
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

      {/* Custom Map Controls */}
      {!isTokenMissing && (
        <div className="absolute bottom-24 right-4 z-20 flex flex-col gap-2">
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
              setSelectedUserCoords({ lat: userLat, lng: userLng });
            }, 300);
          }
        }}
      />
    </>
  );
});

TacticalMap.displayName = 'TacticalMap';

export default TacticalMap;
