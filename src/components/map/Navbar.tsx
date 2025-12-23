import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Target, LogOut, UserCog, MapPin, Ghost, Eye, Search, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import AlertsDrawer from './AlertsDrawer';
import ChatDrawer from './ChatDrawer';
import InstallPrompt from '@/components/InstallPrompt';
import AvatarDisplay from '@/components/avatar/AvatarDisplay';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

interface NavbarProps {
  nick: string;
  avatarUrl: string | null;
  avatarConfig?: AvatarConfig | null;
  currentUserId: string;
  isActive: boolean;
  onActiveChange: (active: boolean) => void;
  onSignOut: () => void;
  onMissionCreated?: () => void;
  onOpenMission?: (missionId: string) => void;
  onFlyToQuest?: (lat: number, lng: number) => void;
  chatOpenUserId?: string | null;
  onChatOpenChange?: (open: boolean) => void;
  onFlyTo: (lat: number, lng: number) => void;
  onLocationUpdated?: (lat: number, lng: number, name: string) => void;
}

const Navbar = ({ 
  nick, 
  avatarUrl,
  avatarConfig,
  currentUserId,
  isActive,
  onActiveChange,
  onSignOut,
  onMissionCreated,
  onOpenMission,
  onFlyToQuest,
  chatOpenUserId,
  onChatOpenChange,
  onFlyTo,
  onLocationUpdated,
}: NavbarProps) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isTeleporting, setIsTeleporting] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();
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
        <div className="container mx-auto px-3 sm:px-4 py-3">
          <div className="flex items-center gap-3">
            {/* Logo - Floating Button Style */}
            <div className="pointer-events-auto flex-shrink-0">
              <div className="flex items-center gap-2 px-3 py-2 bg-card/95 backdrop-blur-md border-2 border-border rounded-xl shadow-hard">
                <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center">
                  <Target className="w-4 h-4 text-primary" />
                </div>
                <span className="font-fredoka text-sm font-bold tracking-tight hidden md:block">
                  SQUAD<span className="text-primary">MAP</span>
                </span>
              </div>
            </div>

            {/* Search Bar - Floating in navbar */}
            <div 
              ref={searchContainerRef}
              className="relative flex-1 max-w-md pointer-events-auto"
            >
              <div className="flex items-center bg-card/95 backdrop-blur-md border-2 border-border rounded-xl shadow-hard overflow-hidden">
              <div className="pl-3 text-muted-foreground">
                {isLoading || isTeleporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                </div>
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search location..."
                  className="border-0 focus-visible:ring-0 font-nunito text-sm bg-transparent h-10"
                  onFocus={() => results.length > 0 && setShowResults(true)}
                />
                {query && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={clearSearch}
                    className="mr-1 h-8 w-8 text-muted-foreground hover:text-foreground"
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

            {/* User Controls - Floating Buttons */}
            <div className="flex items-center gap-2 pointer-events-auto flex-shrink-0">
              {/* Alerts (Public Events) */}
              <div className="bg-card/95 backdrop-blur-md border-2 border-border rounded-xl shadow-hard">
                <AlertsDrawer 
                  currentUserId={currentUserId}
                  onOpenMission={onOpenMission}
                  onFlyToQuest={onFlyToQuest}
                />
              </div>

              {/* Chats (Active Connections) */}
              <div className="bg-card/95 backdrop-blur-md border-2 border-border rounded-xl shadow-hard">
                <ChatDrawer 
                  key={`chat-drawer-${currentUserId}`}
                  currentUserId={currentUserId}
                  externalOpen={!!chatOpenUserId}
                  externalUserId={chatOpenUserId}
                  onOpenChange={onChatOpenChange}
                  onOpenMission={onOpenMission}
                />
              </div>

              {/* Profile Avatar Button */}
              <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
                <SheetTrigger asChild>
                  <button 
                    onClick={() => setSettingsOpen(true)}
                    className="hover:scale-105 transition-transform"
                  >
                    <AvatarDisplay config={avatarConfig} size={52} showGlow={false} />
                  </button>
                </SheetTrigger>
                <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh]">
                  <SheetHeader className="pb-4 border-b border-border/50">
                    <SheetTitle className="font-fredoka text-xl flex items-center gap-3">
                      <div className="w-12 h-12">
                        <AvatarDisplay config={avatarConfig} size={48} showGlow={false} />
                      </div>
                      <div className="text-left">
                        <div>{nick}</div>
                        <div className="text-sm font-nunito font-normal text-muted-foreground">
                          Adventurer Profile
                        </div>
                      </div>
                    </SheetTitle>
                  </SheetHeader>
                  
                  <div className="py-4 space-y-3">
                    <Link to="/profile/edit" onClick={() => setSettingsOpen(false)}>
                      <Button
                        variant="outline"
                        className="w-full justify-start gap-3 border-primary/30 text-primary hover:bg-primary/10 min-h-[48px]"
                      >
                        <UserCog className="w-5 h-5" />
                        <span className="font-medium">Edit Profile</span>
                      </Button>
                    </Link>

                    {/* Ghost Mode Toggle */}
                    <div className={`flex items-center justify-between p-4 rounded-lg border ${
                      isActive 
                        ? 'border-border/50 bg-card/50' 
                        : 'border-muted-foreground/30 bg-muted/20'
                    }`}>
                      <div className="flex items-center gap-3">
                        {isActive ? (
                          <Eye className="w-5 h-5 text-primary" />
                        ) : (
                          <Ghost className="w-5 h-5 text-muted-foreground" />
                        )}
                        <div>
                          <Label htmlFor="ghost-mode" className="font-medium cursor-pointer">
                            {isActive ? 'Visible' : 'Ghost Mode'}
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            {isActive ? 'Others can see you on the map' : 'You are hidden from others'}
                          </p>
                        </div>
                      </div>
                      <Switch
                        id="ghost-mode"
                        checked={isActive}
                        onCheckedChange={onActiveChange}
                      />
                    </div>
                    
                    <InstallPrompt />
                    
                    <Button
                      onClick={() => {
                        setSettingsOpen(false);
                        onSignOut();
                      }}
                      variant="outline"
                      className="w-full justify-start gap-3 border-destructive/30 text-destructive hover:bg-destructive/10 min-h-[48px]"
                    >
                      <LogOut className="w-5 h-5" />
                      <span className="font-medium">Sign Out</span>
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

    </>
  );
};

export default Navbar;
