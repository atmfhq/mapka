import FilterBar from './FilterBar';

interface MapFilterHUDProps {
  activeActivity: string | null;
  onActivityChange: (activity: string | null) => void;
}

const MapFilterHUD = ({ activeActivity, onActivityChange }: MapFilterHUDProps) => {
  return (
    <div className="absolute top-[60px] sm:top-[64px] left-0 right-0 z-20 pointer-events-none">
      {/* Desktop: Full-width glassmorphic HUD bar */}
      <div className="hidden md:block pointer-events-auto">
        <div className="mx-4 mt-3 p-3 rounded-xl bg-card/60 backdrop-blur-lg border border-border/30 shadow-lg">
          <FilterBar 
            activeActivity={activeActivity} 
            onActivityChange={onActivityChange} 
          />
        </div>
      </div>

      {/* Mobile: Floating filter button in corner */}
      <div className="md:hidden pointer-events-auto">
        <div className="mx-3 mt-2">
          <FilterBar 
            activeActivity={activeActivity} 
            onActivityChange={onActivityChange} 
          />
        </div>
      </div>
    </div>
  );
};

export default MapFilterHUD;
