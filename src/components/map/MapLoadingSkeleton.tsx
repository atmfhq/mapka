import { memo, useEffect, useState } from 'react';

interface MapLoadingSkeletonProps {
  isVisible: boolean;
}

/**
 * Lightweight loading indicator - shows only a small status badge
 * Map tiles render immediately; this just indicates content is loading
 */
const MapLoadingSkeleton = memo(({ isVisible }: MapLoadingSkeletonProps) => {
  const [shouldRender, setShouldRender] = useState(isVisible);
  
  // Delayed hide to allow fade-out animation
  useEffect(() => {
    if (!isVisible) {
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
    setShouldRender(true);
  }, [isVisible]);

  if (!shouldRender) return null;

  return (
    <div 
      className={`absolute top-4 right-4 z-20 pointer-events-none transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-2 bg-card/90 backdrop-blur-md border border-border rounded-lg shadow-hard">
        <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        <span className="font-nunito text-xs text-muted-foreground">Loading...</span>
      </div>
    </div>
  );
});

MapLoadingSkeleton.displayName = 'MapLoadingSkeleton';

export default MapLoadingSkeleton;
