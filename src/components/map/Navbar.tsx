import { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, Plane, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ChatDrawer from './ChatDrawer';
import ConnectionsDrawer from './ConnectionsDrawer';
import NotificationsDropdown from './NotificationsDropdown';
import EditProfileModal from './EditProfileModal';
import AvatarDisplay from '@/components/avatar/AvatarDisplay';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { broadcastCurrentUserUpdate } from '@/hooks/useProfilesRealtime';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

interface AvatarConfig {
  skinColor?: string;
  shape?: string;
  eyes?: string;
  mouth?: string;
}

interface SearchResult {
  id: string;
  place_name: string;
  center: [number, number];
}

interface ViewportBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface NavbarProps {
  nick: string;
  avatarUrl: string | null;
  avatarConfig?: AvatarConfig | null;
  currentUserId: string;
  onSignOut: () => void;
  onMissionCreated?: () => void;
  onOpenMission?: (missionId: string) => void;
  chatOpenUserId?: string | null;
  chatOpenEventId?: string | null;
  onChatOpenChange?: (open: boolean) => void;
  onOpenChatWithUser?: (userId: string) => void;
  onFlyTo: (lat: number, lng: number) => void;
  onLocationUpdated?: (lat: number, lng: number, name: string) => void;
  viewportBounds?: ViewportBounds | null;
}

const Navbar = ({ 
  nick, 
  avatarUrl,
  avatarConfig,
  currentUserId,
  onSignOut,
  onMissionCreated,
  onOpenMission,
  chatOpenUserId,
  chatOpenEventId,
  onChatOpenChange,
  onOpenChatWithUser,
  onFlyTo,
  onLocationUpdated,
  viewportBounds,
}: NavbarProps) => {
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isTeleporting, setIsTeleporting] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  // Debounced geocoding search
  const searchLocation = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?access_token=${MAPBOX_TOKEN}&types=place,locality,neighborhood,address&limit=5`
      );
      const data = await response.json();
      
      if (data.features) {
        setResults(data.features.map((f: any) => ({
          id: f.id,
          place_name: f.place_name,
          center: f.center,
        })));
        setShowResults(true);
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounce input
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      searchLocation(query);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, searchLocation]);

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Instant teleport - no confirmation dialog
  const handleSelectResult = async (result: SearchResult) => {
    const [lng, lat] = result.center;
    setShowResults(false);
    setIsTeleporting(true);
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          location_lat: lat,
          location_lng: lng,
          location_name: result.place_name,
        })
        .eq('id', currentUserId);

      if (error) throw error;

      // Broadcast location update for real-time sync (includes full profile data)
      await broadcastCurrentUserUpdate(currentUserId, lat, lng, 'location_update');

      onFlyTo(lat, lng);
      onLocationUpdated?.(lat, lng, result.place_name);
      setQuery(result.place_name);
    } catch (error: any) {
      console.error('Teleport failed:', error);
    } finally {
      setIsTeleporting(false);
      setResults([]);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 pointer-events-none safe-area-top">
        <div className="px-3 sm:px-4 py-3 md:container md:mx-auto">
          <div className="flex items-center gap-3">
            {/* Search Bar - Full width on mobile, constrained on desktop */}
            <div 
              ref={searchContainerRef}
              className="relative flex-1 md:max-w-md pointer-events-auto"
            >
              <div className="flex items-center bg-card border-2 border-border rounded-full shadow-hard overflow-hidden">
                <div className="pl-4 text-muted-foreground">
                  {isLoading || isTeleporting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plane className="w-4 h-4" />
                  )}
                </div>
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Go to location"
                  className="border-0 focus-visible:ring-0 font-nunito text-sm bg-transparent h-11"
                  onFocus={() => results.length > 0 && setShowResults(true)}
                />
                {query && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={clearSearch}
                    className="mr-2 h-8 w-8 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {/* Results Dropdown */}
              {showResults && results.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-card border-2 border-border rounded-xl shadow-hard overflow-hidden z-50">
                  {results.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => handleSelectResult(result)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left border-b border-border/30 last:border-0"
                    >
                      <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="font-nunito text-sm truncate">
                        {result.place_name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Spacer */}
            <div className="flex-1 hidden lg:block" />

            {/* User Controls - Hidden on mobile, shown on desktop */}
            <div className="hidden md:flex items-center gap-2 pointer-events-auto flex-shrink-0">
              {/* Chats (All Conversations) */}
              <div className="bg-card/95 backdrop-blur-md border-2 border-border rounded-xl shadow-hard">
                <ChatDrawer 
                  key={`chat-drawer-${currentUserId}`}
                  currentUserId={currentUserId}
                  externalOpen={!!chatOpenUserId}
                  externalUserId={chatOpenUserId}
                  onOpenChange={onChatOpenChange}
                />
              </div>

              {/* Connections */}
              <div className="bg-card/95 backdrop-blur-md border-2 border-border rounded-xl shadow-hard">
                <ConnectionsDrawer 
                  currentUserId={currentUserId}
                  viewportBounds={viewportBounds ?? null}
                  onFlyTo={onFlyTo}
                  onOpenChat={onOpenChatWithUser}
                />
              </div>

              {/* Notifications (Bell) */}
              <div className="bg-card/95 backdrop-blur-md border-2 border-border rounded-xl shadow-hard">
                <NotificationsDropdown 
                  currentUserId={currentUserId}
                  onFlyToSpot={onFlyTo}
                  onOpenMission={onOpenMission}
                />
              </div>

              {/* Profile Avatar Button */}
              <button 
                onClick={() => setProfileModalOpen(true)}
                className="hover:scale-105 transition-transform"
              >
                <AvatarDisplay config={avatarConfig} size={52} showGlow={false} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Edit Profile Modal */}
      <EditProfileModal 
        open={profileModalOpen} 
        onOpenChange={setProfileModalOpen}
        onSignOut={onSignOut}
      />
    </>
  );
};

export default Navbar;
