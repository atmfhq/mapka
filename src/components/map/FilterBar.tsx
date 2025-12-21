import { useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { ACTIVITY_CATEGORIES, ActivityCategory } from '@/constants/activities';

interface FilterBarProps {
  activeCategory: ActivityCategory | null;
  onCategoryChange: (category: ActivityCategory | null) => void;
}

const FilterBar = ({ activeCategory, onCategoryChange }: FilterBarProps) => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleCategoryClick = (categoryId: ActivityCategory) => {
    if (activeCategory === categoryId) {
      onCategoryChange(null); // Reset
    } else {
      onCategoryChange(categoryId);
    }
  };

  const handleMobileSelect = (categoryId: ActivityCategory) => {
    handleCategoryClick(categoryId);
    setDrawerOpen(false);
  };

  const activeCategoryInfo = activeCategory 
    ? ACTIVITY_CATEGORIES.find(c => c.id === activeCategory)
    : null;

  return (
    <>
      {/* Desktop: Horizontal scrollable categories */}
      <div className="hidden md:flex items-center gap-2">
        {ACTIVITY_CATEGORIES.map((category) => {
          const isActive = activeCategory === category.id;
          
          return (
            <button
              key={category.id}
              onClick={() => handleCategoryClick(category.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg border transition-all duration-300",
                "font-rajdhani text-sm font-medium whitespace-nowrap",
                isActive
                  ? "bg-primary/20 border-primary text-primary shadow-[0_0_12px_hsl(var(--primary)/0.4)]"
                  : "bg-card/50 border-border/50 text-muted-foreground hover:border-primary/50 hover:text-primary/80"
              )}
            >
              <span className="text-base">{category.icon}</span>
              <span>{category.label}</span>
              
              {isActive && (
                <div className="absolute inset-0 rounded-lg bg-primary/10 animate-pulse pointer-events-none" />
              )}
            </button>
          );
        })}
        
        {/* Clear filter button */}
        {activeCategory && (
          <button
            onClick={() => onCategoryChange(null)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-destructive/50 text-destructive hover:bg-destructive/10 transition-all font-rajdhani text-sm"
          >
            <X className="w-4 h-4" />
            Clear
          </button>
        )}
      </div>

      {/* Mobile: Filter button + Drawer */}
      <div className="flex md:hidden items-center gap-2">
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "min-h-[44px] gap-2 font-rajdhani",
                activeCategory && "border-primary text-primary"
              )}
            >
              <SlidersHorizontal className="w-4 h-4" />
              {activeCategoryInfo ? (
                <>
                  <span>{activeCategoryInfo.icon}</span>
                  <span>{activeCategoryInfo.label}</span>
                </>
              ) : (
                <span>Filter</span>
              )}
            </Button>
          </DrawerTrigger>
          <DrawerContent className="max-h-[70vh]">
            <DrawerHeader className="border-b border-border/50">
              <DrawerTitle className="font-orbitron text-lg">Filter by Category</DrawerTitle>
            </DrawerHeader>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-3">
                {ACTIVITY_CATEGORIES.map((category) => {
                  const isActive = activeCategory === category.id;
                  
                  return (
                    <button
                      key={category.id}
                      onClick={() => handleMobileSelect(category.id)}
                      className={cn(
                        "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-300",
                        "font-rajdhani text-sm font-medium min-h-[80px]",
                        isActive
                          ? "bg-primary/20 border-primary text-primary shadow-[0_0_12px_hsl(var(--primary)/0.3)]"
                          : "bg-card/50 border-border/50 text-muted-foreground hover:border-primary/50"
                      )}
                    >
                      <span className="text-2xl">{category.icon}</span>
                      <span>{category.label}</span>
                    </button>
                  );
                })}
              </div>
              
              {/* Clear filter button */}
              {activeCategory && (
                <Button
                  variant="outline"
                  onClick={() => {
                    onCategoryChange(null);
                    setDrawerOpen(false);
                  }}
                  className="w-full mt-4 border-destructive/50 text-destructive hover:bg-destructive/10 min-h-[48px]"
                >
                  <X className="w-4 h-4 mr-2" />
                  Clear Filter
                </Button>
              )}
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </>
  );
};

export default FilterBar;
