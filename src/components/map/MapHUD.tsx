import { Target, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CategoryFilter from './CategoryFilter';
import MissionLog from './MissionLog';

interface MapHUDProps {
  nick: string;
  avatarUrl: string | null;
  activeFilters: string[];
  currentUserId: string;
  onToggleFilter: (categoryId: string) => void;
  onSignOut: () => void;
  onMissionCreated?: () => void;
  onOpenMission?: (missionId: string) => void;
}

const MapHUD = ({ 
  nick, 
  avatarUrl, 
  activeFilters, 
  currentUserId,
  onToggleFilter, 
  onSignOut,
  onMissionCreated,
  onOpenMission,
}: MapHUDProps) => {
  return (
    <header className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
      <div className="bg-background/80 backdrop-blur-md border-b border-border/50 pointer-events-auto">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Logo */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="w-9 h-9 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
                <Target className="w-5 h-5 text-primary" />
              </div>
              <span className="font-orbitron text-lg font-bold tracking-wider hidden sm:block">
                SQUAD<span className="text-primary">MAP</span>
              </span>
            </div>

            {/* Category Filters - Center */}
            <div className="flex-1 flex justify-center overflow-x-auto scrollbar-hide">
              <CategoryFilter 
                activeFilters={activeFilters} 
                onToggle={onToggleFilter} 
              />
            </div>

            {/* User Controls */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Mission Log */}
              <MissionLog 
                currentUserId={currentUserId}
                onMissionCreated={onMissionCreated}
                onOpenMission={onOpenMission}
              />

              <div className="flex items-center gap-2">
                {avatarUrl && (
                  <img
                    src={avatarUrl}
                    alt={nick}
                    className="w-8 h-8 rounded-lg border border-primary/30 object-cover"
                  />
                )}
                <span className="font-rajdhani font-semibold text-sm hidden md:block">
                  {nick}
                </span>
              </div>
              
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onSignOut}
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default MapHUD;
