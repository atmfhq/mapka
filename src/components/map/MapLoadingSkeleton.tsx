import { memo } from 'react';

interface MapLoadingSkeletonProps {
  isVisible: boolean;
}

const MapLoadingSkeleton = memo(({ isVisible }: MapLoadingSkeletonProps) => {
  if (!isVisible) return null;

  return (
    <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
      {/* Scanning indicator */}
      <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-2 bg-card/90 backdrop-blur-md border border-border rounded-lg shadow-hard animate-fade-in">
        <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        <span className="font-nunito text-xs text-muted-foreground">Scanning area...</span>
      </div>

      {/* Skeleton markers scattered on map */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Simulated user skeleton markers */}
        {[
          { top: '25%', left: '30%', delay: '0ms' },
          { top: '40%', left: '55%', delay: '100ms' },
          { top: '60%', left: '25%', delay: '200ms' },
          { top: '35%', left: '70%', delay: '150ms' },
          { top: '55%', left: '45%', delay: '50ms' },
        ].map((pos, i) => (
          <div
            key={`user-${i}`}
            className="absolute animate-pulse"
            style={{ top: pos.top, left: pos.left, animationDelay: pos.delay }}
          >
            <div className="w-10 h-10 rounded-full bg-muted/60 border-2 border-muted animate-pulse" />
          </div>
        ))}

        {/* Simulated quest skeleton markers */}
        {[
          { top: '30%', left: '45%', delay: '75ms' },
          { top: '50%', left: '65%', delay: '175ms' },
          { top: '70%', left: '35%', delay: '125ms' },
        ].map((pos, i) => (
          <div
            key={`quest-${i}`}
            className="absolute animate-pulse"
            style={{ top: pos.top, left: pos.left, animationDelay: pos.delay }}
          >
            <div className="w-12 h-12 rounded-xl bg-muted/50 border-2 border-muted animate-pulse" />
          </div>
        ))}

        {/* Simulated shout skeleton markers */}
        {[
          { top: '20%', left: '60%', delay: '50ms' },
          { top: '65%', left: '55%', delay: '150ms' },
        ].map((pos, i) => (
          <div
            key={`shout-${i}`}
            className="absolute animate-pulse"
            style={{ top: pos.top, left: pos.left, animationDelay: pos.delay }}
          >
            <div className="w-24 h-8 rounded-lg bg-muted/40 border border-muted animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
});

MapLoadingSkeleton.displayName = 'MapLoadingSkeleton';

export default MapLoadingSkeleton;
