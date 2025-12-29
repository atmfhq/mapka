import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Loader2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LocationResult {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
}

interface LocationSearchProps {
  onLocationSelect: (location: {
    lat: number;
    lng: number;
    name: string;
  }) => void;
  initialValue?: string;
  initialCoords?: { lat: number; lng: number } | null;
  fromSpawnIntent?: boolean;
}

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const LocationSearch = ({ 
  onLocationSelect, 
  initialValue = "",
  initialCoords = null,
  fromSpawnIntent = false
}: LocationSearchProps) => {
  const [query, setQuery] = useState(initialValue);
  const [results, setResults] = useState<LocationResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(initialValue || null);
  const [isFromSpawn, setIsFromSpawn] = useState(fromSpawnIntent);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);
  const { toast } = useToast();

  // Handle initial coords from spawn intent - reverse geocode to get location name
  useEffect(() => {
    if (initialCoords && !hasInitialized.current) {
      hasInitialized.current = true;
      
      const reverseGeocode = async () => {
        try {
          const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${initialCoords.lng},${initialCoords.lat}.json?access_token=${MAPBOX_TOKEN}&types=place,locality,neighborhood&limit=1`
          );
          
          if (response.ok) {
            const data = await response.json();
            const placeName = data.features?.[0]?.place_name || `${initialCoords.lat.toFixed(4)}, ${initialCoords.lng.toFixed(4)}`;
            setQuery(placeName);
            setSelectedLocation(placeName);
            onLocationSelect({
              lat: initialCoords.lat,
              lng: initialCoords.lng,
              name: placeName,
            });
          } else {
            const fallbackName = `${initialCoords.lat.toFixed(4)}, ${initialCoords.lng.toFixed(4)}`;
            setQuery(fallbackName);
            setSelectedLocation(fallbackName);
            onLocationSelect({
              lat: initialCoords.lat,
              lng: initialCoords.lng,
              name: fallbackName,
            });
          }
        } catch {
          const fallbackName = `${initialCoords.lat.toFixed(4)}, ${initialCoords.lng.toFixed(4)}`;
          setQuery(fallbackName);
          setSelectedLocation(fallbackName);
          onLocationSelect({
            lat: initialCoords.lat,
            lng: initialCoords.lng,
            name: fallbackName,
          });
        }
      };

      reverseGeocode();
    }
  }, [initialCoords, onLocationSelect]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (!query.trim() || query === selectedLocation) {
      setResults([]);
      setShowResults(false);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&types=place,locality,neighborhood,address&limit=5`
        );

        if (!response.ok) throw new Error("Geocoding failed");

        const data = await response.json();
        setResults(data.features || []);
        setShowResults(true);
      } catch (error) {
        console.error("Geocoding error:", error);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [query, selectedLocation]);

  const handleSelect = (result: LocationResult) => {
    const [lng, lat] = result.center;
    setQuery(result.place_name);
    setSelectedLocation(result.place_name);
    setShowResults(false);
    setResults([]);
    onLocationSelect({
      lat,
      lng,
      name: result.place_name,
    });
  };

  const handleClear = () => {
    setQuery("");
    setSelectedLocation(null);
    setResults([]);
    setShowResults(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {isSearching ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </div>
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value !== selectedLocation) {
              setSelectedLocation(null);
            }
          }}
          onFocus={() => {
            if (results.length > 0) setShowResults(true);
          }}
          placeholder="Search for a city, neighborhood, or address..."
          className="pl-10 pr-10 bg-muted/50 border-2 border-border focus:border-primary font-nunito rounded-xl"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Results dropdown - full width on mobile */}
      {showResults && results.length > 0 && (
        <div className="fixed md:absolute left-0 right-0 md:left-auto md:right-auto md:w-full z-[100] mt-1 mx-2 md:mx-0 bg-card border border-border rounded-lg shadow-xl overflow-hidden">
          {results.map((result) => (
            <button
              key={result.id}
              onClick={() => handleSelect(result)}
              className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b border-border last:border-b-0"
            >
              <MapPin className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <span className="text-sm font-nunito">{result.place_name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Selected indicator */}
      {selectedLocation && (
        <div className="mt-3 flex items-center gap-2 text-success text-sm font-mono">
          <MapPin className="w-4 h-4" />
          <span>{isFromSpawn ? 'Wybrano z mapy!' : 'Location set'}</span>
        </div>
      )}
    </div>
  );
};

export default LocationSearch;
