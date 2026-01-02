import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useIsAdmin = (userId: string | null): { isAdmin: boolean; loading: boolean } => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    const checkAdminStatus = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .eq('role', 'admin')
          .maybeSingle();

        if (error) {
          console.error('Error checking admin status:', error);
          setIsAdmin(false);
        } else {
          setIsAdmin(!!data);
        }
      } catch (err) {
        console.error('Failed to check admin status:', err);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, [userId]);

  return { isAdmin, loading };
};
