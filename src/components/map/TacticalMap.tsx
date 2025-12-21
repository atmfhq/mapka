import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { createRoot, Root } from 'react-dom/client';
import { supabase } from '@/integrations/supabase/client';
import UserPopup from './UserPopup';
import DeployMegaphoneModal from './DeployMegaphoneModal';
import MegaphoneLobby from './MegaphoneLobby';
import AvatarDisplay from '@/components/avatar/AvatarDisplay';
import { Json } from '@/integrations/supabase/types';

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
  bio: string | null;
}

interface Megaphone {
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
  currentUserId: string;
}

export interface TacticalMapHandle {
  fetchMegaphones: () => void;
  openMissionById: (id: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  Sport: '15, 100%, 55%',
  Gaming: '180, 100%, 50%',
  Food: '45, 100%, 55%',
  Party: '320, 100%, 60%',
  Other: '215, 20%, 55%',
};

const PRIVATE_COLOR = '45, 100%, 60%'; // Gold/warning color

// Apply random jitter for privacy (100-400m)
const applyPrivacyJitter = (lat: number, lng: number): [number, number] => {
  const distance = 100 + Math.random() * 300;
  const angle = Math.random() * 2 * Math.PI;
  const latOffset = (distance * Math.cos(angle)) / 111320;
  const lngOffset = (distance * Math.sin(angle)) / (111320 * Math.cos(lat * (Math.PI / 180)));
  return [lat + latOffset, lng + lngOffset];
};

const TacticalMap = forwardRef<TacticalMapHandle, TacticalMapProps>(({ userLat, userLng, currentUserId }, ref) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const userMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const userMarkerRootsRef = useRef<Root[]>([]);
  const megaphoneMarkersRef = useRef<mapboxgl.Marker[]>([]);
  
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [megaphones, setMegaphones] = useState<Megaphone[]>([]);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null);
  
  // Megaphone states
  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const [clickedCoords, setClickedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedMegaphone, setSelectedMegaphone] = useState<Megaphone | null>(null);
  const [lobbyOpen, setLobbyOpen] = useState(false);

  // Fetch profiles
  useEffect(() => {
    const fetchProfiles = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nick, avatar_url, avatar_config, tags, base_lat, base_lng, bio')
        .not('base_lat', 'is', null)
        .not('base_lng', 'is', null);
      
      if (!error && data) {
        const mappedProfiles = data.map(p => ({
          ...p,
          avatar_config: p.avatar_config as AvatarConfig | null
        }));
        setProfiles(mappedProfiles);
      }
    };
    fetchProfiles();
  }, []);

  // Fetch megaphones (only active/future events)
  const fetchMegaphones = useCallback(async () => {
    const { data, error } = await supabase
      .from('megaphones')
      .select('*');
    
    if (!error && data) {
      // Filter to only show events that haven't expired
      const now = Date.now();
      const activeMegaphones = data.filter(m => {
        const startTime = new Date(m.start_time).getTime();
        const endTime = startTime + (m.duration_minutes * 60 * 1000);
        return endTime > now;
      });
      setMegaphones(activeMegaphones);
    }
  }, []);

  // Function to open a mission by ID
  const openMissionById = useCallback(async (missionId: string) => {
    const { data } = await supabase
      .from('megaphones')
      .select('*')
      .eq('id', missionId)
      .maybeSingle();
    
    if (data) {
      setSelectedMegaphone(data);
      setLobbyOpen(true);
    }
  }, []);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    fetchMegaphones,
    openMissionById,
  }), [fetchMegaphones, openMissionById]);

  useEffect(() => {
    fetchMegaphones();
  }, [fetchMegaphones]);

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

      // Navigation controls - positioned to avoid HUD and status indicator
      map.current.addControl(
        new mapboxgl.NavigationControl({ visualizePitch: true }),
        'bottom-right'
      );

      // Position the controls with custom CSS to avoid overlap
      const navControl = document.querySelector('.mapboxgl-ctrl-bottom-right');
      if (navControl) {
        (navControl as HTMLElement).style.bottom = '100px';
        (navControl as HTMLElement).style.right = '16px';
      }

      map.current.addControl(
        new mapboxgl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
          showUserHeading: true,
        }),
        'bottom-right'
      );

      // Click on map to deploy megaphone
      map.current.on('click', (e) => {
        // Check if clicked on a marker (propagation should be stopped)
        const target = e.originalEvent.target as HTMLElement;
        if (target.closest('.user-marker') || target.closest('.megaphone-marker')) {
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

  // Render user markers
  useEffect(() => {
    if (!map.current) return;

    // Cleanup old markers and React roots
    userMarkerRootsRef.current.forEach(root => root.unmount());
    userMarkerRootsRef.current = [];
    userMarkersRef.current.forEach(marker => marker.remove());
    userMarkersRef.current = [];

    profiles.forEach(profile => {
      if (!profile.base_lat || !profile.base_lng) return;
      if (profile.id === currentUserId) return;

      const [jitteredLat, jitteredLng] = applyPrivacyJitter(profile.base_lat, profile.base_lng);

      const el = document.createElement('div');
      el.className = 'user-marker';
      
      // Create container for React rendering
      const container = document.createElement('div');
      container.className = 'marker-container';
      el.appendChild(container);
      
      // Create React root and render AvatarDisplay
      const root = createRoot(container);
      root.render(
        <div className="relative w-12 h-12">
          <div className="marker-ring absolute inset-0 rounded-full border-2 border-primary" 
               style={{ 
                 boxShadow: '0 0 12px hsl(var(--primary) / 0.6), inset 0 0 8px hsl(var(--primary) / 0.3)',
                 animation: 'pulse-ring 2s ease-in-out infinite'
               }} 
          />
          <div className="absolute inset-1">
            <AvatarDisplay 
              config={profile.avatar_config} 
              size={40} 
              showGlow={false}
            />
          </div>
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

    // Cleanup on unmount
    return () => {
      userMarkerRootsRef.current.forEach(root => root.unmount());
      userMarkerRootsRef.current = [];
    };
  }, [profiles, currentUserId]);

  // Render megaphone markers
  useEffect(() => {
    if (!map.current) return;

    megaphoneMarkersRef.current.forEach(marker => marker.remove());
    megaphoneMarkersRef.current = [];

    megaphones.forEach(megaphone => {
      const isPrivate = megaphone.is_private;
      const categoryColor = isPrivate ? PRIVATE_COLOR : (CATEGORY_COLORS[megaphone.category] || CATEGORY_COLORS.Other);

      const el = document.createElement('div');
      el.className = 'megaphone-marker';
      
      // Use lock icon for private events, megaphone for public
      const iconSvg = isPrivate
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
             <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
           </svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <path d="m3 11 18-5v12L3 13v-2z"/>
             <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>
           </svg>`;

      el.innerHTML = `
        <div class="megaphone-container ${isPrivate ? 'private' : ''}" style="--category-color: ${categoryColor}">
          <div class="megaphone-pulse"></div>
          <div class="megaphone-pulse delay-1"></div>
          <div class="megaphone-icon">
            ${iconSvg}
          </div>
        </div>
      `;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedMegaphone(megaphone);
        setLobbyOpen(true);
      });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([megaphone.lng, megaphone.lat])
        .addTo(map.current!);

      megaphoneMarkersRef.current.push(marker);
    });
  }, [megaphones]);

  const isTokenMissing = !MAPBOX_TOKEN || MAPBOX_TOKEN === 'YOUR_MAPBOX_TOKEN_HERE';

  return (
    <>
      <style>{`
        .user-marker {
          cursor: pointer;
        }
        .marker-container {
          position: relative;
          width: 48px;
          height: 48px;
        }
        @keyframes pulse-ring {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.1); }
        }

        /* Megaphone Marker Styles */
        .megaphone-marker {
          cursor: pointer;
        }
        .megaphone-container {
          position: relative;
          width: 56px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .megaphone-pulse {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2px solid hsl(var(--category-color));
          animation: megaphone-expand 2s ease-out infinite;
        }
        .megaphone-pulse.delay-1 {
          animation-delay: 1s;
        }
        @keyframes megaphone-expand {
          0% {
            transform: scale(0.5);
            opacity: 1;
          }
          100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }
        .megaphone-icon {
          position: relative;
          z-index: 1;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: hsl(var(--category-color));
          display: flex;
          align-items: center;
          justify-content: center;
          color: hsl(var(--background));
          box-shadow: 0 0 20px hsl(var(--category-color) / 0.6);
        }
      `}</style>
      
      <div ref={mapContainer} className="absolute inset-0" />
      
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
          onClose={() => {
            setSelectedUser(null);
            setPopupPosition(null);
          }}
        />
      )}

      <DeployMegaphoneModal
        open={deployModalOpen}
        onOpenChange={setDeployModalOpen}
        coordinates={clickedCoords}
        userId={currentUserId}
        onSuccess={fetchMegaphones}
      />

      <MegaphoneLobby
        open={lobbyOpen}
        onOpenChange={setLobbyOpen}
        megaphone={selectedMegaphone}
        currentUserId={currentUserId}
        onDelete={fetchMegaphones}
      />
    </>
  );
});

TacticalMap.displayName = 'TacticalMap';

export default TacticalMap;
