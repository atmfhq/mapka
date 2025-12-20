import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import UserMarker from './UserMarker';
import UserPopup from './UserPopup';

// Placeholder - replace with your Mapbox token or use VITE_MAPBOX_TOKEN env
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || 'YOUR_MAPBOX_TOKEN_HERE';

interface Profile {
  id: string;
  nick: string | null;
  avatar_url: string | null;
  tags: string[] | null;
  base_lat: number | null;
  base_lng: number | null;
  bio: string | null;
}

interface TacticalMapProps {
  userLat: number;
  userLng: number;
  currentUserId: string;
}

// Apply random jitter for privacy (100-400m)
const applyPrivacyJitter = (lat: number, lng: number): [number, number] => {
  // Random distance between 100-400 meters
  const distance = 100 + Math.random() * 300;
  // Random angle
  const angle = Math.random() * 2 * Math.PI;
  
  // Convert meters to degrees (approximate)
  const latOffset = (distance * Math.cos(angle)) / 111320;
  const lngOffset = (distance * Math.sin(angle)) / (111320 * Math.cos(lat * (Math.PI / 180)));
  
  return [lat + latOffset, lng + lngOffset];
};

const TacticalMap = ({ userLat, userLng, currentUserId }: TacticalMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null);

  // Fetch all profiles
  useEffect(() => {
    const fetchProfiles = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nick, avatar_url, tags, base_lat, base_lng, bio')
        .not('base_lat', 'is', null)
        .not('base_lng', 'is', null);
      
      if (!error && data) {
        setProfiles(data);
      }
    };

    fetchProfiles();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return;
    
    // Clean up existing map if any
    if (map.current) {
      map.current.remove();
      map.current = null;
    }

    // Check if token is valid
    if (!MAPBOX_TOKEN || MAPBOX_TOKEN === 'YOUR_MAPBOX_TOKEN_HERE') {
      console.error('Mapbox token not configured. Please set VITE_MAPBOX_TOKEN in your environment.');
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

      map.current.addControl(
        new mapboxgl.NavigationControl({ visualizePitch: true }),
        'bottom-right'
      );

      map.current.addControl(
        new mapboxgl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
          showUserHeading: true,
        }),
        'bottom-right'
      );
    } catch (error) {
      console.error('Failed to initialize map:', error);
    }

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [userLat, userLng]);

  // Render markers for other users
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    profiles.forEach(profile => {
      if (!profile.base_lat || !profile.base_lng) return;
      if (profile.id === currentUserId) return; // Skip current user

      // Apply privacy jitter
      const [jitteredLat, jitteredLng] = applyPrivacyJitter(profile.base_lat, profile.base_lng);

      // Create marker element
      const el = document.createElement('div');
      el.className = 'user-marker';
      el.innerHTML = `
        <div class="marker-container">
          <div class="marker-ring"></div>
          <img 
            src="${profile.avatar_url || '/placeholder.svg'}" 
            alt="${profile.nick || 'User'}"
            class="marker-avatar"
          />
        </div>
      `;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedUser(profile);
        const rect = el.getBoundingClientRect();
        setPopupPosition({ x: rect.left + rect.width / 2, y: rect.top });
      });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([jitteredLng, jitteredLat])
        .addTo(map.current!);

      markersRef.current.push(marker);
    });
  }, [profiles, currentUserId]);

  // Close popup when clicking on map
  useEffect(() => {
    if (!map.current) return;

    const handleClick = () => {
      setSelectedUser(null);
      setPopupPosition(null);
    };

    map.current.on('click', handleClick);
    return () => {
      map.current?.off('click', handleClick);
    };
  }, []);

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
        .marker-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2px solid hsl(var(--primary));
          box-shadow: 0 0 12px hsl(var(--primary) / 0.6), inset 0 0 8px hsl(var(--primary) / 0.3);
          animation: pulse-ring 2s ease-in-out infinite;
        }
        .marker-avatar {
          position: absolute;
          inset: 4px;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          object-fit: cover;
          background: hsl(var(--background));
        }
        @keyframes pulse-ring {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.1); }
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
              Please configure your Mapbox token. The page may need a refresh after the token is added.
            </p>
          </div>
        </div>
      )}
      
      {selectedUser && popupPosition && (
        <UserPopup 
          user={selectedUser} 
          position={popupPosition}
          onClose={() => {
            setSelectedUser(null);
            setPopupPosition(null);
          }}
        />
      )}
    </>
  );
};

export default TacticalMap;
