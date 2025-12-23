import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Fallback to Poznan if no activity found
const FALLBACK_LAT = 52.4064;
const FALLBACK_LNG = 16.9252;

interface ActiveAreaResult {
  lat: number;
  lng: number;
  loading: boolean;
}

export const useActiveArea = (): ActiveAreaResult => {
  const [location, setLocation] = useState<{ lat: number; lng: number }>({
    lat: FALLBACK_LAT,
    lng: FALLBACK_LNG,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActiveArea = async () => {
      try {
        // First, try to get the most recently created public megaphone
        const { data: recentMegaphone, error: megaphoneError } = await supabase
          .from('megaphones')
          .select('lat, lng')
          .eq('is_private', false)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!megaphoneError && recentMegaphone) {
          setLocation({ lat: recentMegaphone.lat, lng: recentMegaphone.lng });
          setLoading(false);
          return;
        }

        // Fallback: try browser geolocation
        if ('geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              setLocation({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              });
              setLoading(false);
            },
            () => {
              // Geolocation denied or failed, keep fallback
              setLoading(false);
            },
            { timeout: 5000, maximumAge: 600000 }
          );
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error fetching active area:', error);
        setLoading(false);
      }
    };

    fetchActiveArea();
  }, []);

  return { ...location, loading };
};
