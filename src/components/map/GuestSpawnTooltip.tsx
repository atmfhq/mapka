import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';

interface GuestSpawnTooltipProps {
  mapContainer: HTMLDivElement | null;
  isVisible: boolean;
}

const GuestSpawnTooltip = ({ mapContainer, isVisible }: GuestSpawnTooltipProps) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    if (!mapContainer || !isVisible) {
      setShowTooltip(false);
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Don't show tooltip when hovering over markers or UI elements
      const isOverMarker = target.closest('.user-marker') || 
                          target.closest('.megaphone-marker') || 
                          target.closest('.quest-marker') ||
                          target.closest('button') ||
                          target.closest('.mapboxgl-ctrl');
      
      if (isOverMarker) {
        setShowTooltip(false);
        return;
      }

      // Check if we're over the map canvas
      const isOverMap = target.closest('.mapboxgl-canvas-container') || 
                        target.classList.contains('mapboxgl-canvas');
      
      if (isOverMap) {
        const rect = mapContainer.getBoundingClientRect();
        setPosition({
          x: e.clientX - rect.left + 15,
          y: e.clientY - rect.top + 15
        });
        setShowTooltip(true);
      } else {
        setShowTooltip(false);
      }
    };

    const handleMouseLeave = () => {
      setShowTooltip(false);
    };

    mapContainer.addEventListener('mousemove', handleMouseMove);
    mapContainer.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      mapContainer.removeEventListener('mousemove', handleMouseMove);
      mapContainer.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [mapContainer, isVisible]);

  if (!isVisible || !showTooltip) return null;

  return (
    <div 
      className="absolute z-50 pointer-events-none animate-fade-in"
      style={{ 
        left: position.x, 
        top: position.y,
        transform: 'translate(0, 0)'
      }}
    >
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg border-2 border-primary-foreground/20 shadow-lg font-fredoka text-sm whitespace-nowrap">
        <MapPin className="w-4 h-4" />
        <span>Click to land here!</span>
      </div>
    </div>
  );
};

export default GuestSpawnTooltip;
