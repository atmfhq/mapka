import { useState, useEffect, useRef } from 'react';

// Haversine distance formula (returns meters)
const haversineDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

interface DebouncedLocation {
  lat: number;
  lng: number;
}

/**
 * Debounces location changes for data fetching optimization.
 * 
 * IMMEDIATE on first render for fast initial load.
 * Subsequent updates wait for:
 * 1. User stops moving for `delayMs` (default 500ms)
 * 2. AND has moved more than `minDistanceMeters` (default 100m)
 */
export const useDebouncedLocation = (
  lat: number,
  lng: number,
  delayMs: number = 500,
  minDistanceMeters: number = 100
): DebouncedLocation => {
  // Initialize with current values immediately (no delay on first render)
  const [debouncedLocation, setDebouncedLocation] = useState<DebouncedLocation>({ lat, lng });
  const lastUpdateRef = useRef({ lat, lng });
  const isFirstRenderRef = useRef(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // On first render, set immediately without debouncing
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      setDebouncedLocation({ lat, lng });
      lastUpdateRef.current = { lat, lng };
      return;
    }

    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Calculate distance from last debounced location
    const distance = haversineDistance(
      lastUpdateRef.current.lat,
      lastUpdateRef.current.lng,
      lat,
      lng
    );

    // Only set timeout if movement is significant enough to warrant a fetch
    if (distance >= minDistanceMeters) {
      timeoutRef.current = setTimeout(() => {
        setDebouncedLocation({ lat, lng });
        lastUpdateRef.current = { lat, lng };
      }, delayMs);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [lat, lng, delayMs, minDistanceMeters]);

  return debouncedLocation;
};
