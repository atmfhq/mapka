import FilterBar from './FilterBar';

export type DateFilter = 'today' | '3days' | '7days';

interface MapFilterHUDProps {
  activeActivities: string[];
  onActivityToggle: (activity: string) => void;
  onClearFilters: () => void;
  dateFilter: DateFilter;
  onDateFilterChange: (filter: DateFilter) => void;
}

const MapFilterHUD = ({ 
  activeActivities, 
  onActivityToggle,
  onClearFilters,
  dateFilter,
  onDateFilterChange,
}: MapFilterHUDProps) => {
  return (
    <div className="fixed top-20 left-0 right-0 z-40 pointer-events-none">
      <div className="container mx-auto px-3 sm:px-4 pointer-events-auto">
        <FilterBar 
          activeActivities={activeActivities} 
          onActivityToggle={onActivityToggle}
          onClearFilters={onClearFilters}
          dateFilter={dateFilter}
          onDateFilterChange={onDateFilterChange}
        />
      </div>
    </div>
  );
};

export default MapFilterHUD;
