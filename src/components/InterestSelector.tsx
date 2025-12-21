import { useState } from "react";
import { Label } from "@/components/ui/label";
import { 
  ACTIVITIES, 
  ACTIVITY_CATEGORIES, 
  Activity,
  ActivityCategory 
} from "@/constants/activities";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

interface InterestSelectorProps {
  selected: string[];
  onChange: (selected: string[]) => void;
}

const InterestSelector = ({ selected, onChange }: InterestSelectorProps) => {
  const [expandedCategory, setExpandedCategory] = useState<ActivityCategory | null>("sport");

  const toggleActivity = (activityId: string) => {
    if (selected.includes(activityId)) {
      onChange(selected.filter((id) => id !== activityId));
    } else {
      onChange([...selected, activityId]);
    }
  };

  const getActivitiesByCategory = (category: ActivityCategory): Activity[] => {
    return ACTIVITIES.filter((a) => a.category === category);
  };

  const getCategoryCount = (category: ActivityCategory): number => {
    return selected.filter((id) => 
      ACTIVITIES.find((a) => a.id === id)?.category === category
    ).length;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="font-mono text-xs uppercase text-muted-foreground">
          Select Your Interests
        </Label>
        <Badge variant="outline" className="font-mono text-xs">
          {selected.length} selected
        </Badge>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2">
        {ACTIVITY_CATEGORIES.map((cat) => {
          const count = getCategoryCount(cat.id);
          const isExpanded = expandedCategory === cat.id;
          
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setExpandedCategory(isExpanded ? null : cat.id)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all duration-200
                ${isExpanded 
                  ? "border-primary bg-primary/20 shadow-[0_0_15px_hsl(var(--primary)/0.3)]" 
                  : "border-border/50 bg-muted/30 hover:border-primary/50"
                }
              `}
            >
              <span className="text-lg">{cat.icon}</span>
              <span className="font-medium text-sm">{cat.label}</span>
              {count > 0 && (
                <Badge className="bg-primary/80 text-xs px-1.5 py-0">
                  {count}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* Activities Grid */}
      {expandedCategory && (
        <div className="pt-4 border-t border-border/30 animate-fade-in-up">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {getActivitiesByCategory(expandedCategory).map((activity) => {
              const isSelected = selected.includes(activity.id);
              
              return (
                <button
                  key={activity.id}
                  type="button"
                  onClick={() => toggleActivity(activity.id)}
                  className={`
                    relative flex items-center gap-2 p-3 rounded-lg border-2 transition-all duration-200 text-left
                    ${isSelected 
                      ? "border-primary bg-primary/20 shadow-[0_0_10px_hsl(var(--primary)/0.2)]" 
                      : "border-border/30 bg-muted/20 hover:border-primary/40 hover:bg-muted/40"
                    }
                  `}
                >
                  <span className="text-xl">{activity.icon}</span>
                  <span className="font-medium text-sm flex-1">{activity.label}</span>
                  {isSelected && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Tags Summary */}
      {selected.length > 0 && (
        <div className="pt-4 border-t border-border/30">
          <Label className="font-mono text-xs uppercase text-muted-foreground mb-2 block">
            Your Interests
          </Label>
          <div className="flex flex-wrap gap-2">
            {selected.map((id) => {
              const activity = ACTIVITIES.find((a) => a.id === id);
              if (!activity) return null;
              
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleActivity(id)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-primary/20 border border-primary/30 text-sm hover:bg-destructive/20 hover:border-destructive/30 transition-colors group"
                >
                  <span>{activity.icon}</span>
                  <span>{activity.label}</span>
                  <span className="text-muted-foreground group-hover:text-destructive">×</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default InterestSelector;
