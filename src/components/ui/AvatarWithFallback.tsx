import { useState, useCallback, memo } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from './skeleton';
import { User } from 'lucide-react';
import AvatarDisplay from '@/components/avatar/AvatarDisplay';

interface AvatarConfig {
  skinColor?: string;
  shape?: string;
  eyes?: string;
  mouth?: string;
}

interface AvatarWithFallbackProps {
  avatarConfig?: AvatarConfig | null;
  avatarUrl?: string | null;
  nick?: string | null;
  size?: number;
  className?: string;
  showGlow?: boolean;
}

/**
 * Smart avatar component that:
 * 1. Uses AvatarDisplay (SVG) when avatar_config is available
 * 2. Falls back to image URL if no config
 * 3. Shows initials if nick is available but no avatar
 * 4. Shows generic user icon as last resort
 * 5. Handles loading and error states gracefully
 */
const AvatarWithFallback = memo(({
  avatarConfig,
  avatarUrl,
  nick,
  size = 40,
  className,
  showGlow = false,
}: AvatarWithFallbackProps) => {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const handleImageLoad = useCallback(() => {
    setImageLoading(false);
    setImageError(false);
  }, []);

  const handleImageError = useCallback(() => {
    setImageLoading(false);
    setImageError(true);
  }, []);

  // Get initials from nick
  const getInitials = (name: string | null): string => {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Calculate font size based on avatar size
  const fontSize = Math.max(10, Math.floor(size * 0.35));

  // If we have avatar_config, use the SVG-based AvatarDisplay
  if (avatarConfig && (avatarConfig.skinColor || avatarConfig.shape || avatarConfig.eyes || avatarConfig.mouth)) {
    return (
      <AvatarDisplay
        config={avatarConfig}
        size={size}
        className={className}
        showGlow={showGlow}
      />
    );
  }

  // If we have an avatar URL, try to load it
  if (avatarUrl && !imageError) {
    return (
      <div 
        className={cn("relative overflow-hidden rounded-full", className)}
        style={{ width: size, height: size }}
      >
        {/* Skeleton while loading */}
        {imageLoading && (
          <Skeleton className="absolute inset-0 rounded-full" />
        )}
        
        {/* Image */}
        <img
          src={avatarUrl}
          alt={nick || 'User avatar'}
          className={cn(
            "w-full h-full object-cover rounded-full",
            imageLoading && 'opacity-0'
          )}
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
      </div>
    );
  }

  // Fallback: Show initials if we have a nick
  if (nick) {
    const initials = getInitials(nick);
    return (
      <div
        className={cn(
          "rounded-full bg-muted flex items-center justify-center border-2 border-border",
          className
        )}
        style={{ width: size, height: size }}
      >
        <span 
          className="font-nunito font-bold text-muted-foreground"
          style={{ fontSize }}
        >
          {initials}
        </span>
      </div>
    );
  }

  // Last resort: Generic user icon
  return (
    <div
      className={cn(
        "rounded-full bg-muted flex items-center justify-center border-2 border-border",
        className
      )}
      style={{ width: size, height: size }}
    >
      <User 
        className="text-muted-foreground" 
        style={{ width: size * 0.5, height: size * 0.5 }}
      />
    </div>
  );
});

AvatarWithFallback.displayName = 'AvatarWithFallback';

export { AvatarWithFallback };
export type { AvatarConfig };
