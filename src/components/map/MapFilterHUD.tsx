import FilterBar from './FilterBar';

export type DateFilter = 'today' | '3days' | '7days';

interface MapFilterHUDProps {
  activeActivity: string | null;
  onActivityChange: (activity: string | null) => void;
  dateFilter: DateFilter;
  onDateFilterChange: (filter: DateFilter) => void;
}

const MapFilterHUD = ({ 
  activeActivity, 
  onActivityChange,
  dateFilter,
  onDateFilterChange,
}: MapFilterHUDProps) => {
  return (
    <div className="absolute top-[60px] sm:top-[64px] left-0 right-0 z-20 pointer-events-none">
      <div className="container mx-auto px-3 sm:px-4 pt-3 pointer-events-auto">
        <FilterBar 
          activeActivity={activeActivity} 
          onActivityChange={onActivityChange}
          dateFilter={dateFilter}
          onDateFilterChange={onDateFilterChange}
        />
      </div>
    </div>
  );
};

export default MapFilterHUD;
