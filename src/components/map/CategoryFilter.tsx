import { Dumbbell, Gamepad2, UtensilsCrossed, Users, Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Category {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const categories: Category[] = [
  { id: 'sports', label: 'Sports', icon: Dumbbell },
  { id: 'gaming', label: 'Gaming', icon: Gamepad2 },
  { id: 'food', label: 'Food', icon: UtensilsCrossed },
  { id: 'social', label: 'Social', icon: Users },
  { id: 'tech', label: 'Tech', icon: Cpu },
];

interface CategoryFilterProps {
  activeFilters: string[];
  onToggle: (categoryId: string) => void;
}

const CategoryFilter = ({ activeFilters, onToggle }: CategoryFilterProps) => {
  return (
    <div className="flex items-center gap-2">
      {categories.map((category) => {
        const isActive = activeFilters.includes(category.id);
        const Icon = category.icon;
        
        return (
          <button
            key={category.id}
            onClick={() => onToggle(category.id)}
            className={cn(
              "relative flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-300",
              "font-rajdhani text-sm font-medium",
              isActive
                ? "bg-primary/20 border-primary text-primary shadow-[0_0_12px_hsl(var(--primary)/0.4)]"
                : "bg-card/50 border-border/50 text-muted-foreground hover:border-primary/50 hover:text-primary/80"
            )}
          >
            <Icon className={cn(
              "w-4 h-4 transition-all",
              isActive && "drop-shadow-[0_0_6px_hsl(var(--primary))]"
            )} />
            <span className="hidden sm:inline">{category.label}</span>
            
            {/* Active glow indicator */}
            {isActive && (
              <div className="absolute inset-0 rounded-lg bg-primary/10 animate-pulse pointer-events-none" />
            )}
          </button>
        );
      })}
    </div>
  );
};

export default CategoryFilter;
