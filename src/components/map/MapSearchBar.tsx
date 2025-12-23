import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, MapPin, X, Loader2, LogIn } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

interface SearchResult {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
}

interface MapSearchBarProps {
  onFlyTo: (lat: number, lng: number) => void;
  isGuest: boolean;
  currentUserId?: string | null;
  onLocationUpdated?: (lat: number, lng: number, name: string) => void;
}

const MapSearchBar = ({ 
  onFlyTo, 
  isGuest, 
  currentUserId,
  onLocationUpdated 
}: MapSearchBarProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<SearchResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
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
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectResult = (result: SearchResult) => {
    const [lng, lat] = result.center;
    
    if (isGuest) {
      // Guest: just fly to location
      onFlyTo(lat, lng);
      setQuery(result.place_name);
      setShowResults(false);
      setResults([]);
    } else {
      // Logged in: ask if they want to update their location
      setPendingLocation(result);
      setConfirmDialogOpen(true);
      setShowResults(false);
    }
  };

  const handleJustView = () => {
    if (pendingLocation) {
      const [lng, lat] = pendingLocation.center;
      onFlyTo(lat, lng);
      setQuery(pendingLocation.place_name);
    }
    setConfirmDialogOpen(false);
    setPendingLocation(null);
    setResults([]);
  };

  const handleUpdateLocation = async () => {
    if (!pendingLocation || !currentUserId) return;
    
    setIsSaving(true);
    const [lng, lat] = pendingLocation.center;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          location_lat: lat,
          location_lng: lng,
          location_name: pendingLocation.place_name,
        })
        .eq('id', currentUserId);

      if (error) throw error;

      toast({
        title: 'Location Updated',
        description: 'Your position has been relocated',
      });

      onFlyTo(lat, lng);
      onLocationUpdated?.(lat, lng, pendingLocation.place_name);
      setQuery(pendingLocation.place_name);
    } catch (error: any) {
      toast({
        title: 'Update Failed',
        description: error.message || 'Could not update location',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
      setConfirmDialogOpen(false);
      setPendingLocation(null);
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
      <div 
        ref={containerRef}
        className="absolute top-20 left-1/2 -translate-x-1/2 z-20 w-[90%] max-w-md"
      >
        {/* Search Input */}
        <div className="relative">
          <div className="flex items-center bg-card border-3 border-border rounded-xl shadow-hard overflow-hidden">
            <div className="pl-4 text-muted-foreground">
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Search className="w-5 h-5" />
              )}
            </div>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search city or address..."
              className="border-0 focus-visible:ring-0 font-nunito text-base bg-transparent"
              onFocus={() => results.length > 0 && setShowResults(true)}
            />
            {query && (
              <Button
                variant="ghost"
                size="icon"
                onClick={clearSearch}
                className="mr-1 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Results Dropdown */}
          {showResults && results.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-card border-3 border-border rounded-xl shadow-hard overflow-hidden">
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

        {/* Guest hint */}
        {isGuest && (
          <div className="mt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <button
              onClick={() => navigate('/auth')}
              className="flex items-center gap-1 text-primary hover:underline font-medium"
            >
              <LogIn className="w-3 h-3" />
              Sign in to save your location
            </button>
          </div>
        )}
      </div>

      {/* Confirmation Dialog for logged-in users */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-fredoka flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              Move to this location?
            </DialogTitle>
            <DialogDescription className="font-nunito">
              {pendingLocation?.place_name}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              Do you want to update your position on the map, or just view this area?
            </p>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleJustView}
              className="w-full sm:w-auto"
            >
              Just View
            </Button>
            <Button
              onClick={handleUpdateLocation}
              disabled={isSaving}
              className="w-full sm:w-auto"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <MapPin className="w-4 h-4" />
                  Update My Location
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MapSearchBar;
