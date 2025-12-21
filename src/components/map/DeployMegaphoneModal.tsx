import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Megaphone, Users, Clock, MapPin, AlertTriangle, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { ACTIVITY_CATEGORIES, ACTIVITIES, ActivityCategory, getActivitiesByCategory, getActivityById } from '@/constants/activities';

interface DeployMegaphoneModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coordinates: { lat: number; lng: number } | null;
  userId: string;
  onSuccess: () => void;
}

const DeployMegaphoneModal = ({ 
  open, 
  onOpenChange, 
  coordinates, 
  userId, 
  onSuccess 
}: DeployMegaphoneModalProps) => {
  const [title, setTitle] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ActivityCategory | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState('18:00');
  const [maxParticipants, setMaxParticipants] = useState(4);
  const [duration, setDuration] = useState(2);
  const [loading, setLoading] = useState(false);

  // Get activities for selected category
  const categoryActivities = useMemo(() => {
    if (!selectedCategory) return [];
    return getActivitiesByCategory(selectedCategory);
  }, [selectedCategory]);

  const selectedActivityData = selectedActivity ? getActivityById(selectedActivity) : null;
  const selectedCategoryData = selectedCategory ? ACTIVITY_CATEGORIES.find(c => c.id === selectedCategory) : null;

  const handleCategorySelect = (categoryId: ActivityCategory) => {
    setSelectedCategory(categoryId);
    setSelectedActivity(null); // Reset activity when category changes
  };

  const handleActivitySelect = (activityId: string) => {
    setSelectedActivity(activityId);
  };

  const handleBack = () => {
    if (selectedActivity) {
      setSelectedActivity(null);
    } else if (selectedCategory) {
      setSelectedCategory(null);
    }
  };

  const handleSubmit = async () => {
    if (!title || !selectedActivity || !date || !coordinates) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    // Combine date and time
    const [hours, minutes] = time.split(':').map(Number);
    const startTime = new Date(date);
    startTime.setHours(hours, minutes, 0, 0);

    // Save the activity label as the category (for backwards compatibility and filtering)
    const activityData = getActivityById(selectedActivity);
    
    const { error } = await supabase.from('megaphones').insert({
      title,
      category: activityData?.label || selectedActivity, // Store activity label
      start_time: startTime.toISOString(),
      duration_minutes: duration * 60,
      max_participants: maxParticipants,
      lat: coordinates.lat,
      lng: coordinates.lng,
      host_id: userId,
    });

    setLoading(false);

    if (error) {
      toast({
        title: "Deploy failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Megaphone Deployed!",
      description: "Your event is now live on the tactical map.",
    });

    // Reset form
    setTitle('');
    setSelectedCategory(null);
    setSelectedActivity(null);
    setDate(undefined);
    setTime('18:00');
    setMaxParticipants(4);
    setDuration(2);
    onSuccess();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-primary/30 max-w-md max-h-[90vh] overflow-y-auto">
        {/* Tactical header */}
        <DialogHeader className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/20 border border-warning/40">
              <Megaphone className="w-6 h-6 text-warning" />
            </div>
            <div>
              <DialogTitle className="font-orbitron text-xl tracking-wide">
                DEPLOY MEGAPHONE
              </DialogTitle>
              <p className="text-xs text-muted-foreground font-mono mt-1">
                TACTICAL EVENT BROADCAST
              </p>
            </div>
          </div>
          
          {/* Coordinates display */}
          {coordinates && (
            <div className="flex items-center gap-2 px-3 py-2 rounded bg-muted/50 border border-border/50">
              <MapPin className="w-4 h-4 text-primary" />
              <span className="font-mono text-xs text-muted-foreground">
                {coordinates.lat.toFixed(4)}, {coordinates.lng.toFixed(4)}
              </span>
            </div>
          )}
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Title */}
          <div className="space-y-2">
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Mission Title
            </Label>
            <Input
              placeholder="e.g., Quick 3v3 Basketball"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-muted/50 border-border/50 focus:border-primary"
            />
          </div>

          {/* Activity Selection - 2-Step */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Activity Type
              </Label>
              {(selectedCategory || selectedActivity) && (
                <button
                  onClick={handleBack}
                  className="text-xs text-primary hover:underline font-rajdhani"
                >
                  ← Back
                </button>
              )}
            </div>

            {/* Show selected activity */}
            {selectedActivityData && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/40">
                <span className="text-2xl">{selectedActivityData.icon}</span>
                <div>
                  <p className="font-semibold text-primary">{selectedActivityData.label}</p>
                  <p className="text-xs text-muted-foreground capitalize">{selectedActivityData.category}</p>
                </div>
                <button
                  onClick={() => setSelectedActivity(null)}
                  className="ml-auto text-muted-foreground hover:text-foreground"
                >
                  Change
                </button>
              </div>
            )}

            {/* Step 1: Category Selection */}
            {!selectedCategory && !selectedActivityData && (
              <div className="grid grid-cols-2 gap-2">
                {ACTIVITY_CATEGORIES.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => handleCategorySelect(category.id)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border transition-all",
                      "bg-muted/30 border-border/50 hover:border-primary/50 hover:bg-primary/5"
                    )}
                  >
                    <span className="text-2xl">{category.icon}</span>
                    <span className="font-rajdhani font-medium">{category.label}</span>
                    <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}

            {/* Step 2: Activity Selection */}
            {selectedCategory && !selectedActivityData && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground">
                  <span>{selectedCategoryData?.icon}</span>
                  <span className="font-rajdhani">{selectedCategoryData?.label}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
                  {categoryActivities.map((activity) => (
                    <button
                      key={activity.id}
                      onClick={() => handleActivitySelect(activity.id)}
                      className={cn(
                        "flex items-center gap-2 p-2.5 rounded-lg border transition-all text-left",
                        "bg-muted/30 border-border/50 hover:border-primary/50 hover:bg-primary/5"
                      )}
                    >
                      <span className="text-lg">{activity.icon}</span>
                      <span className="font-rajdhani text-sm truncate">{activity.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Date and Time Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Date
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal bg-muted/50 border-border/50",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "MMM d") : "Pick date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    disabled={(d) => d < new Date()}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Time
              </Label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="bg-muted/50 border-border/50"
              />
            </div>
          </div>

          {/* Participants and Duration Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Users className="w-3 h-3" /> Max Squad
              </Label>
              <Input
                type="number"
                min={2}
                max={50}
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(Number(e.target.value))}
                className="bg-muted/50 border-border/50"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" /> Duration (hrs)
              </Label>
              <Input
                type="number"
                min={0.5}
                max={24}
                step={0.5}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="bg-muted/50 border-border/50"
              />
            </div>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 p-3 rounded bg-warning/10 border border-warning/30">
            <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <p className="text-xs text-warning/80">
              Once deployed, your megaphone will be visible to all operatives in the area.
            </p>
          </div>

          {/* Submit */}
          <Button 
            onClick={handleSubmit}
            disabled={loading || !selectedActivity}
            className="w-full bg-warning hover:bg-warning/90 text-warning-foreground font-orbitron tracking-wider min-h-[52px]"
          >
            {loading ? (
              <span className="animate-pulse">DEPLOYING...</span>
            ) : (
              <>
                <Megaphone className="w-5 h-5 mr-2" />
                DEPLOY MEGAPHONE
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeployMegaphoneModal;
