import { useState, useCallback, memo } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from './skeleton';
import { ImageOff, MapPin } from 'lucide-react';

interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackType?: 'content' | 'avatar' | 'icon';
  fallbackIcon?: React.ReactNode;
  skeletonClassName?: string;
  initials?: string;
}

/**
 * Robust image component with loading skeleton and error fallback.
 * - Shows skeleton while loading
 * - Shows fallback on error (customizable per type)
 * - Handles broken links gracefully
 */
const ImageWithFallback = memo(({
  src,
  alt,
  className,
  fallbackType = 'content',
  fallbackIcon,
  skeletonClassName,
  initials,
  ...props
}: ImageWithFallbackProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
  }, []);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  // Reset states when src changes
  const [prevSrc, setPrevSrc] = useState(src);
  if (src !== prevSrc) {
    setPrevSrc(src);
    setIsLoading(true);
    setHasError(false);
  }

  // Render fallback based on type
  const renderFallback = () => {
    if (fallbackIcon) {
      return fallbackIcon;
    }

    switch (fallbackType) {
      case 'avatar':
        if (initials) {
          return (
            <div className={cn(
              "w-full h-full rounded-full bg-muted flex items-center justify-center",
              className
            )}>
              <span className="text-muted-foreground font-nunito font-bold text-sm">
                {initials.slice(0, 2).toUpperCase()}
              </span>
            </div>
          );
        }
        return (
          <div className={cn(
            "w-full h-full rounded-full bg-muted flex items-center justify-center",
            className
          )}>
            <ImageOff className="w-1/3 h-1/3 text-muted-foreground" />
          </div>
        );
      
      case 'content':
      default:
        return (
          <div className={cn(
            "w-full h-full bg-muted/50 flex items-center justify-center rounded-lg border border-border/50",
            className
          )}>
            <div className="flex flex-col items-center gap-1 text-muted-foreground">
              <MapPin className="w-6 h-6" />
              <span className="text-xs font-nunito">Image unavailable</span>
            </div>
          </div>
        );
    }
  };

  if (hasError || !src) {
    return renderFallback();
  }

  return (
    <div className="relative">
      {/* Skeleton while loading */}
      {isLoading && (
        <Skeleton 
          className={cn(
            "absolute inset-0",
            fallbackType === 'avatar' ? 'rounded-full' : 'rounded-lg',
            skeletonClassName
          )} 
        />
      )}
      
      {/* Actual image */}
      <img
        src={src}
        alt={alt}
        className={cn(
          className,
          isLoading && 'opacity-0'
        )}
        onLoad={handleLoad}
        onError={handleError}
        {...props}
      />
    </div>
  );
});

ImageWithFallback.displayName = 'ImageWithFallback';

export { ImageWithFallback };
