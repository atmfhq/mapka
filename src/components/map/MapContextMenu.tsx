import { useState, useEffect, useRef } from 'react';
import { MapPin, Megaphone, MessageCircle, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { broadcastCurrentUserUpdate } from '@/hooks/useProfilesRealtime';

interface MapContextMenuProps {
  coords: { lat: number; lng: number };
  screenPosition: { x: number; y: number };
  currentUserId: string;
  onClose: () => void;
  onMoveComplete: (lat: number, lng: number) => void;
  onAddEvent: (lat: number, lng: number) => void;
  onAddShout: (lat: number, lng: number) => void;
}

const MapContextMenu = ({
  coords,
  screenPosition,
  currentUserId,
  onClose,
  onMoveComplete,
  onAddEvent,
  onAddShout,
}: MapContextMenuProps) => {
  const { toast } = useToast();
  const [isMoving, setIsMoving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Calculate smart position to avoid overflow
  const getSmartPosition = () => {
    const menuWidth = 200;
    const menuHeight = 120;
    const padding = 16;
    
    let x = screenPosition.x;
    let y = screenPosition.y;
    
    // Check right edge
    if (x + menuWidth + padding > window.innerWidth) {
      x = window.innerWidth - menuWidth - padding;
    }
    
    // Check left edge
    if (x < padding) {
      x = padding;
    }
    
    // Check bottom edge
    if (y + menuHeight + padding > window.innerHeight) {
      y = y - menuHeight - 10;
    }
    
    // Check top edge
    if (y < padding) {
      y = padding;
    }
    
    return { x, y };
  };

  const position = getSmartPosition();

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleMoveHere = async () => {
    setIsMoving(true);
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          location_lat: coords.lat,
          location_lng: coords.lng,
        })
        .eq('id', currentUserId);

      if (error) throw error;

      // Broadcast location update for real-time sync (includes full profile data)
      await broadcastCurrentUserUpdate(currentUserId, coords.lat, coords.lng, 'location_update');

      onMoveComplete(coords.lat, coords.lng);
      onClose();
    } catch (error: any) {
      console.error('Move failed:', error);
    } finally {
      setIsMoving(false);
    }
  };

  const handleAddEvent = () => {
    onAddEvent(coords.lat, coords.lng);
    onClose();
  };

  const handleAddShout = () => {
    onAddShout(coords.lat, coords.lng);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] animate-in fade-in zoom-in-95 duration-150"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <div className="bg-card border-2 border-border rounded-xl shadow-hard overflow-hidden min-w-[180px]">
        {/* Header with close button */}
        <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
          <span className="font-nunito text-xs text-muted-foreground">Actions</span>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-muted transition-colors"
          >
            <X className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>

        {/* Menu items */}
        <div className="p-1">
          <button
            onClick={handleMoveHere}
            disabled={isMoving}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-primary/10 transition-colors text-left disabled:opacity-50"
          >
            <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-primary" />
            </div>
            <span className="font-nunito text-sm font-medium">
              {isMoving ? 'Moving...' : 'Move me here'}
            </span>
          </button>

          <button
            onClick={handleAddEvent}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-warning/10 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-warning/20 border border-warning/40 flex items-center justify-center">
              <Megaphone className="w-4 h-4 text-warning" />
            </div>
            <span className="font-nunito text-sm font-medium">Add event</span>
          </button>

          <button
            onClick={handleAddShout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent/10 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-accent/20 border border-accent/40 flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-accent" />
            </div>
            <span className="font-nunito text-sm font-medium">Add shout</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MapContextMenu;
