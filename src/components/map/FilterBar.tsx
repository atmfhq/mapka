import { useState } from 'react';
import { SlidersHorizontal, X, ChevronDown, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { ACTIVITY_CATEGORIES, ActivityCategory, getActivitiesByCategory, getActivityById, Activity } from '@/constants/activities';

export type DateFilter = 'today' | '3days' | '7days';

const DATE_FILTER_OPTIONS: { id: DateFilter; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '3days', label: '3 Days' },
  { id: '7days', label: '7 Days' },
];

interface FilterBarProps {
  activeActivities: string[];
  onActivityToggle: (activity: string) => void;
  onClearFilters: () => void;
  dateFilter: DateFilter;
  onDateFilterChange: (filter: DateFilter) => void;
}

const FilterBar = ({ activeActivities, onActivityToggle, onClearFilters, dateFilter, onDateFilterChange }: FilterBarProps) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<ActivityCategory | null>(null);

  // Get all active activity data for display
  const activeActivityDataList = activeActivities.map(id => getActivityById(id)).filter(Boolean);

  const handleCategoryClick = (categoryId: ActivityCategory) => {
    if (expandedCategory === categoryId) {
      setExpandedCategory(null);
    } else {
      setExpandedCategory(categoryId);
    }
  };

  const handleActivityClick = (activityId: string) => {
    onActivityToggle(activityId);
  };

  const handleMobileCategorySelect = (categoryId: ActivityCategory) => {
    setExpandedCategory(categoryId);
  };

  const handleMobileActivitySelect = (activityId: string) => {
    onActivityToggle(activityId);
    // Don't close drawer - allow multi-select
  };

  const expandedActivities = expandedCategory ? getActivitiesByCategory(expandedCategory) : [];
  const expandedCategoryInfo = expandedCategory ? ACTIVITY_CATEGORIES.find(c => c.id === expandedCategory) : null;

  // Check if category has any active activities
  const getCategoryActiveCount = (categoryId: ActivityCategory) => {
    const categoryActivities = getActivitiesByCategory(categoryId);
    return categoryActivities.filter(a => activeActivities.includes(a.id)).length;
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Desktop: Categories row (left) + Date filters (right) */}
      <div className="hidden md:flex items-center justify-between w-full">
        {/* GROUP A: Category filters (left) */}
        <div className="flex items-center gap-2">
          {ACTIVITY_CATEGORIES.map((category) => {
            const isExpanded = expandedCategory === category.id;
            const activeCount = getCategoryActiveCount(category.id);
            const hasActiveActivity = activeCount > 0;
            
            return (
              <button
                key={category.id}
                onClick={() => handleCategoryClick(category.id)}
                className={cn(
                  "relative flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition-all duration-300 flex-shrink-0",
                  "font-nunito text-sm font-medium whitespace-nowrap",
                  isExpanded || hasActiveActivity
                    ? "bg-primary/20 border-primary text-primary"
                    : "bg-card/50 border-border text-muted-foreground hover:border-primary/50 hover:text-primary/80"
                )}
              >
                <span className="text-base">{category.icon}</span>
                <span>{category.label}</span>
                {activeCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    {activeCount}
                  </span>
                )}
                <ChevronDown className={cn(
                  "w-4 h-4 transition-transform",
                  isExpanded && "rotate-180"
                )} />
              </button>
            );
          })}
          
          {/* Clear filter button */}
          {activeActivities.length > 0 && (
            <button
              onClick={() => {
                onClearFilters();
                setExpandedCategory(null);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-destructive/50 text-destructive hover:bg-destructive/10 transition-all font-rajdhani text-sm flex-shrink-0"
            >
              <X className="w-4 h-4" />
              Clear ({activeActivities.length})
            </button>
          )}
        </div>

        {/* GROUP B: Date Filter Pills (right) */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {DATE_FILTER_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => onDateFilterChange(option.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg border transition-all duration-300 flex-shrink-0",
                "font-rajdhani text-sm font-medium whitespace-nowrap",
                dateFilter === option.id
                  ? "bg-warning/20 border-warning text-warning"
                  : "bg-card/50 border-border/50 text-muted-foreground hover:border-warning/50 hover:text-warning/80"
              )}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Desktop: Activities sub-row (when category is expanded) */}
      {expandedCategory && (
        <div className="hidden md:flex items-center gap-2 px-2 py-2 rounded-lg bg-muted/30 border border-border/30 overflow-x-auto scrollbar-hide">
          <span className="text-xs text-muted-foreground font-mono px-2 flex-shrink-0">
            {expandedCategoryInfo?.icon} {expandedCategoryInfo?.label}:
          </span>
          <div className="flex items-center gap-1.5">
            {expandedActivities.map((activity) => {
              const isActive = activeActivities.includes(activity.id);
              
              return (
                <button
                  key={activity.id}
                  onClick={() => handleActivityClick(activity.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all duration-200",
                    "font-rajdhani text-xs font-medium whitespace-nowrap",
                    isActive
                      ? "bg-primary text-primary-foreground border-primary shadow-[0_0_10px_hsl(var(--primary)/0.4)]"
                      : "bg-card/80 border-border/50 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  )}
                >
                  <span>{activity.icon}</span>
                  <span>{activity.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Mobile: Category drawer + spacer + Date pills */}
      <div className="flex md:hidden items-center gap-2">
        <Drawer open={drawerOpen} onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setExpandedCategory(null);
        }}>
          <DrawerTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "min-h-[44px] gap-2 font-rajdhani flex-shrink-0",
                activeActivities.length > 0 && "border-primary text-primary"
              )}
            >
              <SlidersHorizontal className="w-4 h-4" />
              {activeActivities.length > 0 ? (
                <>
                  <span>Filters</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    {activeActivities.length}
                  </span>
                </>
              ) : (
                <span>Activity</span>
              )}
            </Button>
          </DrawerTrigger>
          <DrawerContent className="max-h-[80vh]">
            <DrawerHeader className="border-b border-border/50">
              <DrawerTitle className="font-orbitron text-lg flex items-center gap-2">
                {expandedCategory ? (
                  <>
                    <button 
                      onClick={() => setExpandedCategory(null)}
                      className="text-primary hover:underline text-sm font-rajdhani"
                    >
                      ← Back
                    </button>
                    <span className="mx-2 text-muted-foreground">/</span>
                    <span>{expandedCategoryInfo?.icon} {expandedCategoryInfo?.label}</span>
                  </>
                ) : (
                  "Filter by Activity"
                )}
              </DrawerTitle>
            </DrawerHeader>
            <div className="p-4 overflow-y-auto">
              {/* Category Grid */}
              {!expandedCategory && (
                <div className="grid grid-cols-2 gap-3">
                  {ACTIVITY_CATEGORIES.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => handleMobileCategorySelect(category.id)}
                      className={cn(
                        "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-300",
                        "font-rajdhani text-sm font-medium min-h-[80px]",
                        "bg-card/50 border-border/50 text-muted-foreground hover:border-primary/50"
                      )}
                    >
                      <span className="text-2xl">{category.icon}</span>
                      <span>{category.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Activity Grid */}
              {expandedCategory && (
                <div className="grid grid-cols-2 gap-2">
                  {expandedActivities.map((activity) => {
                    const isActive = activeActivities.includes(activity.id);
                    
                    return (
                      <button
                        key={activity.id}
                        onClick={() => handleMobileActivitySelect(activity.id)}
                        className={cn(
                          "flex items-center gap-2 p-3 rounded-lg border transition-all",
                          "font-rajdhani text-sm font-medium",
                          isActive
                            ? "bg-primary/20 border-primary text-primary"
                            : "bg-card/50 border-border/50 text-muted-foreground hover:border-primary/50"
                        )}
                      >
                        <span className="text-lg">{activity.icon}</span>
                        <span className="truncate">{activity.label}</span>
                        {isActive && <span className="ml-auto text-primary">✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
              
              {/* Clear filter button */}
              {activeActivities.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => {
                    onClearFilters();
                    setDrawerOpen(false);
                  }}
                  className="w-full mt-4 border-destructive/50 text-destructive hover:bg-destructive/10 min-h-[48px]"
                >
                  <X className="w-4 h-4 mr-2" />
                  Clear All ({activeActivities.length})
                </Button>
              )}
            </div>
          </DrawerContent>
        </Drawer>

        {/* Spacer to push date filters right */}
        <div className="flex-1" />

        {/* Mobile Date Filter Pills (right group) */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {DATE_FILTER_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => onDateFilterChange(option.id)}
              className={cn(
                "px-2.5 py-2 rounded-lg border transition-all duration-200 flex-shrink-0",
                "font-rajdhani text-xs font-medium whitespace-nowrap",
                dateFilter === option.id
                  ? "bg-warning/20 border-warning text-warning"
                  : "bg-card/50 border-border/50 text-muted-foreground"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FilterBar;
