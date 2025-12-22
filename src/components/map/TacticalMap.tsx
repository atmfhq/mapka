import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { createRoot, Root } from 'react-dom/client';
import { supabase } from '@/integrations/supabase/client';
import UserPopupContent from './UserPopupContent';
import DeployQuestModal from './DeployQuestModal';
import QuestLobby from './QuestLobby';
import AvatarDisplay from '@/components/avatar/AvatarDisplay';
import { Json } from '@/integrations/supabase/types';
import { ACTIVITIES, getCategoryForActivity, getActivityById } from '@/constants/activities';
import { useConnectedUsers } from '@/hooks/useConnectedUsers';
import { Button } from '@/components/ui/button';
import { Crosshair, Plus, Minus, Compass } from 'lucide-react';

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
  currentUserId: string;
  activeActivities: string[];
  dateFilter: DateFilter;
  currentUserAvatarConfig?: AvatarConfig | null;
  locationLat?: number | null;
  locationLng?: number | null;
  isGhostMode?: boolean;
  onOpenChatWithUser?: (userId: string) => void;
  onCloseChat?: () => void;
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
  onOpenChatWithUser,
  onCloseChat
}, ref) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const userMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const userMarkerRootsRef = useRef<Root[]>([]);
  const questMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const myMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const myMarkerRootRef = useRef<Root | null>(null);
  
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [joinedQuestIds, setJoinedQuestIds] = useState<Set<string>>(new Set());
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [selectedUserCoords, setSelectedUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const userPopupRef = useRef<mapboxgl.Popup | null>(null);
  const userPopupRootRef = useRef<Root | null>(null);
  
  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const [clickedCoords, setClickedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
  const [lobbyOpen, setLobbyOpen] = useState(false);
  const [isTacticalView, setIsTacticalView] = useState(true);

  // Get connected users
  const { connectedUserIds, getInvitationIdForUser, refetch: refetchConnections } = useConnectedUsers(currentUserId);

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
    
    const { data, error } = await supabase.rpc('get_nearby_profiles', {
      p_lat: centerLat,
      p_lng: centerLng,
      p_radius_meters: 5000 // 5km radius
    });
    
    if (!error && data) {
      const mappedProfiles = data.map((p: any) => ({
        ...p,
        avatar_config: p.avatar_config as AvatarConfig | null,
        is_active: p.is_active ?? true
      }));
      setProfiles(mappedProfiles);
    } else if (error) {
      console.error('Error fetching nearby profiles:', error);
    }
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

  // Fetch quests the current user has joined
  const fetchJoinedQuestIds = useCallback(async () => {
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
      map.current.flyTo({
        center: [lng, lat],
        zoom: 14,
        pitch: 45,
        duration: 2000,
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

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return;
    if (map.current) {
      map.current.remove();
      map.current = null;
    }

    if (!MAPBOX_TOKEN || MAPBOX_TOKEN === 'YOUR_MAPBOX_TOKEN_HERE') {
      console.error('Mapbox token not configured');
      return;
    }

    mapboxgl.accessToken = MAPBOX_TOKEN;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [userLng, userLat],
        zoom: 14,
        pitch: 45,
      });

      // No default controls - we use custom ones

      map.current.on('click', (e) => {
        const target = e.originalEvent.target as HTMLElement;
        if (target.closest('.user-marker') || target.closest('.megaphone-marker') || target.closest('.quest-marker')) {
          return;
        }
        
        setClickedCoords({ lat: e.lngLat.lat, lng: e.lngLat.lng });
        setDeployModalOpen(true);
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
  }, [userLat, userLng]);

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

        // Dark fill covering everything EXCEPT the circle
        map.current?.addLayer({
          id: 'fog-of-war-fill',
          type: 'fill',
          source: 'fog-of-war',
          paint: {
            'fill-color': '#000000',
            'fill-opacity': 0.7
          }
        });

        // Add separate source for the border (circle only)
        map.current?.addSource('range-border', {
          type: 'geojson',
          data: circleBorderData
        });

        // Border/stroke layer on the circle edge
        map.current?.addLayer({
          id: 'range-circle-border',
          type: 'line',
          source: 'range-border',
          paint: {
            'line-color': 'hsl(180, 100%, 50%)', // Primary cyan
            'line-width': 2,
            'line-dasharray': [4, 2] // Dashed line for tactical feel
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

  // Render user markers with connected status
  useEffect(() => {
    if (!map.current) return;

    userMarkerRootsRef.current.forEach(root => root.unmount());
    userMarkerRootsRef.current = [];
    userMarkersRef.current.forEach(marker => marker.remove());
    userMarkersRef.current = [];

    filteredProfiles.forEach(profile => {
      // Use location_lat/lng for user position
      const profileLat = profile.location_lat;
      const profileLng = profile.location_lng;
      
      if (!profileLat || !profileLng) return;
      if (profile.id === currentUserId) return;

      const isConnected = connectedUserIds.has(profile.id);

      const el = document.createElement('div');
      el.className = 'user-marker';
      el.style.zIndex = '10';
      
      const container = document.createElement('div');
      container.className = 'marker-container';
      el.appendChild(container);
      
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
      userMarkerRootsRef.current.push(root);

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        // Fly to user location smoothly
        const userLat = profile.location_lat;
        const userLng = profile.location_lng;
        if (userLat && userLng && map.current) {
          map.current.flyTo({
            center: [userLng, userLat],
            zoom: 15,
            pitch: 45,
            duration: 1500,
            essential: true
          });
        }
        setSelectedUser(profile);
        // Store geo coordinates for the popup (use the actual profile location, not jittered)
        if (userLat && userLng) {
          setSelectedUserCoords({ lat: userLat, lng: userLng });
        }
      });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([profileLng, profileLat])
        .addTo(map.current!);

      userMarkersRef.current.push(marker);
    });

    return () => {
      userMarkerRootsRef.current.forEach(root => root.unmount());
      userMarkerRootsRef.current = [];
    };
  }, [filteredProfiles, currentUserId, connectedUserIds]);

  // Render "My Avatar" marker at current location
  useEffect(() => {
    if (!map.current) return;

    // Clean up previous marker
    if (myMarkerRootRef.current) {
      myMarkerRootRef.current.unmount();
      myMarkerRootRef.current = null;
    }
    if (myMarkerRef.current) {
      myMarkerRef.current.remove();
      myMarkerRef.current = null;
    }

    // Use location_lat/lng
    const myLat = locationLat ?? userLat;
    const myLng = locationLng ?? userLng;

    if (!myLat || !myLng) return;

    const el = document.createElement('div');
    el.className = `my-marker ${isGhostMode ? 'ghost-mode' : ''}`;
    
    const container = document.createElement('div');
    container.className = 'my-marker-container';
    el.appendChild(container);
    
    const root = createRoot(container);
    root.render(
      <div className={`my-avatar-ring ${isGhostMode ? 'ghost' : ''}`}>
        <AvatarDisplay 
          config={currentUserAvatarConfig} 
          size={44} 
          showGlow={false}
        />
      </div>
    );
    myMarkerRootRef.current = root;

    const marker = new mapboxgl.Marker({ element: el })
      .setLngLat([myLng, myLat])
      .addTo(map.current!);

    myMarkerRef.current = marker;

    return () => {
      if (myMarkerRootRef.current) {
        myMarkerRootRef.current.unmount();
        myMarkerRootRef.current = null;
      }
    };
  }, [locationLat, locationLng, userLat, userLng, currentUserAvatarConfig, isGhostMode]);

  // Render quest markers (public only) with dynamic activity icons
  useEffect(() => {
    if (!map.current) return;

    questMarkersRef.current.forEach(marker => marker.remove());
    questMarkersRef.current = [];

    filteredQuests.forEach(quest => {
      // Get dynamic icon and color based on activity
      const activityIcon = getActivityIcon(quest.category);
      const categoryColor = getCategoryColor(quest.category);
      // Highlight if user is host OR participant
      const isMyQuest = quest.host_id === currentUserId || joinedQuestIds.has(quest.id);
      
      // Check if quest is "Live Now"
      const now = Date.now();
      const startTime = new Date(quest.start_time).getTime();
      const endTime = startTime + (quest.duration_minutes * 60 * 1000);
      const isLiveNow = startTime <= now && endTime >= now;

      const el = document.createElement('div');
      el.className = `quest-marker ${isMyQuest ? 'my-quest' : ''} ${isLiveNow ? 'live-now' : ''}`;
      el.style.zIndex = '20';

      // Build DOM safely to prevent XSS - no innerHTML with dynamic content
      const container = document.createElement('div');
      container.className = 'quest-container';
      container.style.setProperty('--category-color', categoryColor);

      if (isLiveNow) {
        const pulse = document.createElement('div');
        pulse.className = 'live-pulse';
        container.appendChild(pulse);
      }

      const iconDiv = document.createElement('div');
      iconDiv.className = `quest-icon ${isMyQuest ? 'my-quest-icon' : ''} ${isLiveNow ? 'live-icon' : ''}`;
      iconDiv.textContent = activityIcon; // textContent is XSS-safe
      container.appendChild(iconDiv);

      el.appendChild(container);

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        // Fly to quest location smoothly
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

      questMarkersRef.current.push(marker);
    });
  }, [filteredQuests, currentUserId, joinedQuestIds]);

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
        .user-marker {
          cursor: pointer;
        }
        .marker-container {
          position: relative;
          width: 40px;
          height: 40px;
        }
        /* Squircle style for user avatars - full image visible */
        .user-avatar-marker {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3), 0 1px 3px rgba(0, 0, 0, 0.2);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .user-avatar-marker:hover {
          transform: scale(1.1);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4), 0 2px 6px rgba(0, 0, 0, 0.3);
        }
        /* Connected user - no glow, same shadow */
        .user-avatar-marker.connected {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3), 0 1px 3px rgba(0, 0, 0, 0.2);
        }
        .user-avatar-marker.connected:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4), 0 2px 6px rgba(0, 0, 0, 0.3);
        }
        .my-marker {
          cursor: pointer;
        }
        .my-marker-container {
          position: relative;
          width: 44px;
          height: 44px;
        }
        /* Current user marker - slightly larger squircle, no glow */
        .my-avatar-ring {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
          transition: all 0.3s ease;
        }
        .my-avatar-ring.ghost {
          opacity: 0.5;
          filter: grayscale(100%);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
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
        }
        .quest-icon {
          position: relative;
          z-index: 1;
          width: 56px;
          height: 56px;
          border-radius: 14px;
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
          background: hsl(var(--primary) / 0.2);
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
      
      <div ref={mapContainer} className="absolute inset-0" />

      {/* Custom Map Controls */}
      {!isTokenMissing && (
        <div className="absolute bottom-24 right-4 z-20 flex flex-col gap-2">
          {/* Center on Base Button */}
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
            title="Center on Base"
          >
            <Crosshair className="w-5 h-5 text-primary" />
          </Button>

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
        </div>
      )}
      
      {isTokenMissing && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="text-center p-6 rounded-lg border border-destructive/50 bg-card max-w-md">
            <h3 className="font-orbitron text-lg font-bold text-destructive mb-2">
              Map Token Required
            </h3>
            <p className="text-muted-foreground text-sm">
              Please configure your Mapbox token in the .env file.
            </p>
          </div>
        </div>
      )}
      
      {/* User popup is now rendered via Mapbox Popup in useEffect above */}

      <DeployQuestModal
        open={deployModalOpen}
        onOpenChange={setDeployModalOpen}
        coordinates={clickedCoords}
        userId={currentUserId}
        userBaseLat={locationLat ?? userLat}
        userBaseLng={locationLng ?? userLng}
        onSuccess={(newQuest) => {
          // Add the new quest to state immediately for instant UI update
          setQuests(prev => [...prev, newQuest]);
        }}
      />

      <QuestLobby
        open={lobbyOpen}
        onOpenChange={setLobbyOpen}
        quest={selectedQuest}
        currentUserId={currentUserId}
        onDelete={fetchQuests}
        onJoin={(questId) => {
          // Add to joined quest IDs immediately for instant marker highlight
          setJoinedQuestIds(prev => new Set([...prev, questId]));
        }}
        onLeave={(questId) => {
          // Remove from joined quest IDs immediately
          setJoinedQuestIds(prev => {
            const next = new Set(prev);
            next.delete(questId);
            return next;
          });
        }}
        onUpdate={(updatedQuest) => {
          // Update the quest in local state immediately
          setQuests(prev => prev.map(q => q.id === updatedQuest.id ? updatedQuest : q));
          setSelectedQuest(updatedQuest);
        }}
        onViewUserProfile={(user) => {
          // Fly to user's location if available
          const userLat = user.location_lat;
          const userLng = user.location_lng;
          if (userLat && userLng) {
            flyTo(userLat, userLng);
            
            // Show user popup at their geo location after a brief delay for modal close
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
