import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Target, LogIn, UserPlus, Search, X, Loader2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

interface SearchResult {
  id: string;
  place_name: string;
  center: [number, number];
}

interface GuestNavbarProps {
  onFlyTo: (lat: number, lng: number) => void;
}

const GuestNavbar = ({ onFlyTo }: GuestNavbarProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();

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

  const handleSelectResult = (result: SearchResult) => {
    const [lng, lat] = result.center;
    onFlyTo(lat, lng);
    setQuery(result.place_name);
    setShowResults(false);
    setResults([]);
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  return (
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
                {isLoading ? (
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

          {/* Guest Controls - Floating Buttons */}
          <div className="flex items-center gap-2 pointer-events-auto flex-shrink-0">
            <Link to="/auth">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 font-nunito h-10 bg-card/95 backdrop-blur-md border-2 border-border shadow-hard"
              >
                <LogIn className="w-4 h-4" />
                <span className="hidden sm:inline">Sign In</span>
              </Button>
            </Link>
            <Link to="/auth">
              <Button
                size="sm"
                className="gap-2 font-nunito h-10 shadow-hard"
              >
                <UserPlus className="w-4 h-4" />
                <span className="hidden sm:inline">Join</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};

export default GuestNavbar;
