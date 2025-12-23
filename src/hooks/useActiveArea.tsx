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

/**
 * Hook to find an active area for guests to view.
 * Privacy-first: Never uses device GPS/geolocation.
 * Falls back to a default location if no public quests exist.
 */
export const useActiveArea = (): ActiveAreaResult => {
  const [location, setLocation] = useState<{ lat: number; lng: number }>({
    lat: FALLBACK_LAT,
    lng: FALLBACK_LNG,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActiveArea = async () => {
      try {
        // Try to get the most recently created public megaphone
        const { data: recentMegaphone, error: megaphoneError } = await supabase
          .from('megaphones')
          .select('lat, lng')
          .eq('is_private', false)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!megaphoneError && recentMegaphone) {
          setLocation({ lat: recentMegaphone.lat, lng: recentMegaphone.lng });
        }
        // Otherwise keep the default fallback location
        // No GPS/geolocation used - privacy first!
      } catch (error) {
        console.error('Error fetching active area:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchActiveArea();
  }, []);

  return { ...location, loading };
};
