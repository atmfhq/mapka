import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { createRoot, Root } from 'react-dom/client';
import { supabase } from '@/integrations/supabase/client';
import UserPopup from './UserPopup';
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
  base_lat: number | null;
  base_lng: number | null;
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

interface TacticalMapProps {
  userLat: number;
  userLng: number;
  baseLat: number;
  baseLng: number;
  currentUserId: string;
  activeActivity: string | null;
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

// Apply random jitter for privacy (100-400m)
const applyPrivacyJitter = (lat: number, lng: number): [number, number] => {
  const distance = 100 + Math.random() * 300;
  const angle = Math.random() * 2 * Math.PI;
  const latOffset = (distance * Math.cos(angle)) / 111320;
  const lngOffset = (distance * Math.sin(angle)) / (111320 * Math.cos(lat * (Math.PI / 180)));
  return [lat + latOffset, lng + lngOffset];
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
  activeActivity,
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
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null);
  
  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const [clickedCoords, setClickedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
  const [lobbyOpen, setLobbyOpen] = useState(false);
  const [isTacticalView, setIsTacticalView] = useState(true);

  // Get connected users
  const { connectedUserIds, getInvitationIdForUser, refetch: refetchConnections } = useConnectedUsers(currentUserId);

  const activeActivityData = activeActivity ? getActivityById(activeActivity) : null;
  const activeActivityLabel = activeActivityData?.label?.toLowerCase();

  // Filter profiles based on active activity AND is_active status
  // Rule: Only show active users, EXCEPT always show current user (themselves)
  const filteredProfiles = useMemo(() => {
    // First filter by is_active (but always include current user)
    const activeProfiles = profiles.filter(profile => 
      profile.is_active || profile.id === currentUserId
    );
    
    // Then filter by activity if one is selected
    if (!activeActivity || !activeActivityLabel) return activeProfiles;
    
    return activeProfiles.filter(profile => {
      if (!profile.tags || profile.tags.length === 0) return false;
      return profile.tags.some(tag => tag.toLowerCase() === activeActivityLabel);
    });
  }, [profiles, activeActivity, activeActivityLabel, currentUserId]);

  // Filter quests - HIDE PRIVATE EVENTS from map
  const filteredQuests = useMemo(() => {
    // First filter out private events - they should not appear on map
    const publicQuests = quests.filter(m => !m.is_private);
    
    if (!activeActivity || !activeActivityLabel) return publicQuests;
    
    return publicQuests.filter(q => {
      const questCat = q.category.toLowerCase();
      return questCat === activeActivityLabel || questCat === activeActivity;
    });
  }, [quests, activeActivity, activeActivityLabel]);

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
          
          // Update the profile in state if it has valid coordinates (location_lat/lng OR base_lat/lng)
          const hasLocation = updatedProfile.location_lat !== null && updatedProfile.location_lng !== null;
          const hasBase = updatedProfile.base_lat !== null && updatedProfile.base_lng !== null;
          
          if (hasLocation || hasBase) {
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
        setPopupPosition(null);
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
      // Prioritize location_lat/lng (teleport) over base_lat/lng (original position)
      const profileLat = profile.location_lat ?? profile.base_lat;
      const profileLng = profile.location_lng ?? profile.base_lng;
      
      if (!profileLat || !profileLng) return;
      if (profile.id === currentUserId) return;

      const [jitteredLat, jitteredLng] = applyPrivacyJitter(profileLat, profileLng);
      const isConnected = connectedUserIds.has(profile.id);

      const el = document.createElement('div');
      el.className = 'user-marker';
      
      const container = document.createElement('div');
      container.className = 'marker-container';
      el.appendChild(container);
      
      const root = createRoot(container);
      root.render(
        <div className={`w-10 h-10 rounded-full overflow-hidden border-2 bg-background ${
          isConnected 
            ? 'border-green-500 shadow-[0_0_12px_rgba(34,197,94,0.6)]' 
            : 'border-white/60'
        }`}>
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
        setSelectedUser(profile);
        const rect = el.getBoundingClientRect();
        setPopupPosition({ x: rect.left + rect.width / 2, y: rect.top });
      });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([jitteredLng, jitteredLat])
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

    // Use location_lat/lng if available, otherwise fall back to base_lat/lng
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
          size={48} 
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

      const el = document.createElement('div');
      el.className = 'quest-marker';

      el.innerHTML = `
        <div class="quest-container" style="--category-color: ${categoryColor}">
          <div class="quest-ring ring-1"></div>
          <div class="quest-ring ring-2"></div>
          <div class="quest-ring ring-3"></div>
          <div class="quest-glow"></div>
          <div class="quest-icon">
            ${activityIcon}
          </div>
        </div>
      `;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedQuest(quest);
        setLobbyOpen(true);
      });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([quest.lng, quest.lat])
        .addTo(map.current!);

      questMarkersRef.current.push(marker);
    });
  }, [filteredQuests]);

  const isTokenMissing = !MAPBOX_TOKEN || MAPBOX_TOKEN === 'YOUR_MAPBOX_TOKEN_HERE';
  const isSelectedUserConnected = selectedUser ? connectedUserIds.has(selectedUser.id) : false;
  const selectedUserInvitationId = selectedUser ? getInvitationIdForUser(selectedUser.id) : undefined;

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
        .my-marker {
          cursor: pointer;
        }
        .my-marker-container {
          position: relative;
          width: 52px;
          height: 52px;
        }
        .my-avatar-ring {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          overflow: hidden;
          border: 3px solid #fbbf24;
          box-shadow: 0 0 12px rgba(251, 191, 36, 0.5);
          background: hsl(var(--background));
          transition: all 0.3s ease;
        }
        .my-avatar-ring.ghost {
          opacity: 0.5;
          filter: grayscale(100%);
          border-color: #6b7280;
          box-shadow: 0 0 8px rgba(107, 114, 128, 0.4);
        }
        .my-marker.ghost-mode {
          opacity: 0.6;
        }
        .quest-marker {
          cursor: pointer;
        }
        .quest-container {
          position: relative;
          width: 80px;
          height: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .quest-ring {
          position: absolute;
          border-radius: 50%;
          border: 2px solid hsl(var(--category-color));
          animation: quest-ring-pulse 3s ease-out infinite;
        }
        .quest-ring.ring-1 {
          width: 100%;
          height: 100%;
          animation-delay: 0s;
        }
        .quest-ring.ring-2 {
          width: 85%;
          height: 85%;
          animation-delay: 1s;
        }
        .quest-ring.ring-3 {
          width: 70%;
          height: 70%;
          animation-delay: 2s;
        }
        @keyframes quest-ring-pulse {
          0% {
            transform: scale(0.8);
            opacity: 1;
          }
          50% {
            opacity: 0.6;
          }
          100% {
            transform: scale(1.4);
            opacity: 0;
          }
        }
        .quest-glow {
          position: absolute;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: radial-gradient(circle, hsl(var(--category-color) / 0.4) 0%, transparent 70%);
          animation: quest-glow-pulse 2s ease-in-out infinite;
        }
        @keyframes quest-glow-pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 0.6;
          }
          50% {
            transform: scale(1.2);
            opacity: 1;
          }
        }
        .quest-icon {
          position: relative;
          z-index: 1;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(135deg, hsl(var(--category-color)) 0%, hsl(var(--category-color) / 0.8) 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          box-shadow: 
            0 0 20px hsl(var(--category-color) / 0.8),
            0 0 40px hsl(var(--category-color) / 0.4),
            inset 0 2px 4px rgba(255,255,255,0.3);
          border: 2px solid hsl(var(--category-color) / 0.9);
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
      
      {selectedUser && popupPosition && (
        <UserPopup 
          user={selectedUser} 
          position={popupPosition}
          currentUserId={currentUserId}
          isConnected={isSelectedUserConnected}
          invitationId={selectedUserInvitationId}
          onClose={() => {
            setSelectedUser(null);
            setPopupPosition(null);
          }}
          onOpenChat={onOpenChatWithUser}
          onDisconnect={refetchConnections}
          onCloseChat={onCloseChat}
        />
      )}

      <DeployQuestModal
        open={deployModalOpen}
        onOpenChange={setDeployModalOpen}
        coordinates={clickedCoords}
        userId={currentUserId}
        userBaseLat={locationLat ?? userLat}
        userBaseLng={locationLng ?? userLng}
        onSuccess={fetchQuests}
      />

      <QuestLobby
        open={lobbyOpen}
        onOpenChange={setLobbyOpen}
        quest={selectedQuest}
        currentUserId={currentUserId}
        onDelete={fetchQuests}
      />
    </>
  );
});

TacticalMap.displayName = 'TacticalMap';

export default TacticalMap;
