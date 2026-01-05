import { createContext, useContext, useRef, useCallback, ReactNode } from 'react';

/**
 * Context for triggering map data refetches
 * Used when engagement data changes but map data isn't using React Query yet
 */
interface MapRefetchContextValue {
  registerShoutRefetch: (refetch: () => void) => () => void;
  registerEventRefetch: (refetch: () => void) => () => void;
  registerCountRefetch: (refetch: () => void) => () => void;
  triggerShoutRefetch: () => void;
  triggerEventRefetch: () => void;
  triggerCountRefetch: () => void;
}

const MapRefetchContext = createContext<MapRefetchContextValue | null>(null);

export const MapRefetchProvider = ({ children }: { children: ReactNode }) => {
  const shoutRefetchesRef = useRef<Set<() => void>>(new Set());
  const eventRefetchesRef = useRef<Set<() => void>>(new Set());
  const countRefetchesRef = useRef<Set<() => void>>(new Set());

  const registerShoutRefetch = useCallback((refetch: () => void) => {
    shoutRefetchesRef.current.add(refetch);
    return () => {
      shoutRefetchesRef.current.delete(refetch);
    };
  }, []);

  const registerEventRefetch = useCallback((refetch: () => void) => {
    eventRefetchesRef.current.add(refetch);
    return () => {
      eventRefetchesRef.current.delete(refetch);
    };
  }, []);

  const registerCountRefetch = useCallback((refetch: () => void) => {
    countRefetchesRef.current.add(refetch);
    return () => {
      countRefetchesRef.current.delete(refetch);
    };
  }, []);

  const triggerShoutRefetch = useCallback(() => {
    console.log('[MapRefetch] Triggering shout refetch, registered functions:', shoutRefetchesRef.current.size);
    shoutRefetchesRef.current.forEach(refetch => {
      try {
        refetch();
      } catch (error) {
        console.error('Error triggering shout refetch:', error);
      }
    });
  }, []);

  const triggerEventRefetch = useCallback(() => {
    console.log('[MapRefetch] Triggering event refetch, registered functions:', eventRefetchesRef.current.size);
    eventRefetchesRef.current.forEach(refetch => {
      try {
        refetch();
      } catch (error) {
        console.error('Error triggering event refetch:', error);
      }
    });
  }, []);

  const triggerCountRefetch = useCallback(() => {
    console.log('[MapRefetch] Triggering count refetch, registered functions:', countRefetchesRef.current.size);
    countRefetchesRef.current.forEach(refetch => {
      try {
        refetch();
      } catch (error) {
        console.error('Error triggering count refetch:', error);
      }
    });
  }, []);

  return (
    <MapRefetchContext.Provider
      value={{
        registerShoutRefetch,
        registerEventRefetch,
        registerCountRefetch,
        triggerShoutRefetch,
        triggerEventRefetch,
        triggerCountRefetch,
      }}
    >
      {children}
    </MapRefetchContext.Provider>
  );
};

export const useMapRefetch = () => {
  const context = useContext(MapRefetchContext);
  if (!context) {
    // Return no-ops if context not available (for backwards compatibility)
    // This can happen during hot reload or if hook is called outside provider
    console.warn('[useMapRefetch] Context not available - returning no-ops. Make sure MapRefetchProvider wraps the component.');
    return {
      registerShoutRefetch: () => () => {},
      registerEventRefetch: () => () => {},
      registerCountRefetch: () => () => {},
      triggerShoutRefetch: () => {},
      triggerEventRefetch: () => {},
      triggerCountRefetch: () => {},
    };
  }
  return context;
};

