import { useState, useMemo, useEffect } from 'react';
import { format, startOfDay, isToday } from 'date-fns';
import { CalendarIcon, Compass, Clock, MapPin, AlertTriangle, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { ACTIVITY_CATEGORIES, ACTIVITIES, ActivityCategory, getActivitiesByCategory, getActivityById } from '@/constants/activities';

// Get minimum time for today (current time + 15 min buffer, rounded up to next 5 min)
const getMinTimeForToday = (): string => {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 15); // Add 15 min buffer
  // Round up to next 5 minutes
  const minutes = Math.ceil(now.getMinutes() / 5) * 5;
  now.setMinutes(minutes);
  const hours = now.getHours().toString().padStart(2, '0');
  const mins = now.getMinutes().toString().padStart(2, '0');
  return `${hours}:${mins}`;
};

// Haversine formula to calculate distance between two points in meters
const calculateDistanceMeters = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6371000; // Earth's radius in meters
  const toRad = (deg: number) => deg * (Math.PI / 180);
  
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
};

const MAX_RANGE_METERS = 5000; // 5km range limit

interface Quest {
  id: string;
  title: string;
  category: string;
  start_time: string;
  duration_minutes: number;
  max_participants: number | null;
  lat: number;
  lng: number;
  host_id: string;
  is_private?: boolean;
}

interface DeployQuestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coordinates: { lat: number; lng: number } | null;
  userId: string;
  userBaseLat: number;
  userBaseLng: number;
  onSuccess: (quest: Quest) => void;
}

const DeployQuestModal = ({ 
  open, 
  onOpenChange, 
  coordinates, 
  userId,
  userBaseLat,
  userBaseLng,
  onSuccess 
}: DeployQuestModalProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ActivityCategory | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState('18:00');
  const [duration, setDuration] = useState(2);
  const [loading, setLoading] = useState(false);

  // Get activities for selected category
  const categoryActivities = useMemo(() => {
    if (!selectedCategory) return [];
    return getActivitiesByCategory(selectedCategory);
  }, [selectedCategory]);

  // Calculate min time based on selected date
  const minTime = useMemo(() => {
    if (!date) return undefined;
    if (isToday(date)) {
      return getMinTimeForToday();
    }
    return undefined; // No restriction for future dates
  }, [date]);

  // Auto-adjust time if it's below minimum when date changes to today
  useEffect(() => {
    if (date && isToday(date)) {
      const min = getMinTimeForToday();
      if (time < min) {
        setTime(min);
      }
    }
  }, [date]);

  const selectedActivityData = selectedActivity ? getActivityById(selectedActivity) : null;
  const selectedCategoryData = selectedCategory ? ACTIVITY_CATEGORIES.find(c => c.id === selectedCategory) : null;

  // Calculate distance from user's base to clicked coordinates
  const distanceToTarget = useMemo(() => {
    if (!coordinates) return 0;
    return calculateDistanceMeters(userBaseLat, userBaseLng, coordinates.lat, coordinates.lng);
  }, [coordinates, userBaseLat, userBaseLng]);

  const isOutOfRange = distanceToTarget > MAX_RANGE_METERS;

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

    // Check if location is within 5km range
    if (isOutOfRange) {
      toast({
        title: "Out of Range!",
        description: "You can only place signals within 5km of your Base.",
        variant: "destructive",
      });
      return;
    }

    // Combine date and time
    const [hours, minutes] = time.split(':').map(Number);
    const startTime = new Date(date);
    startTime.setHours(hours, minutes, 0, 0);

    // Validate that start time is in the future
    if (startTime <= new Date()) {
      toast({
        title: "Invalid time",
        description: "Event start time must be in the future.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    // Save the activity label as the category (for backwards compatibility and filtering)
    const activityData = getActivityById(selectedActivity);
    
    const { data, error } = await supabase.from('megaphones').insert({
      title,
      description: description.trim() || null,
      category: activityData?.label || selectedActivity, // Store activity label
      start_time: startTime.toISOString(),
      duration_minutes: duration * 60,
      lat: coordinates.lat,
      lng: coordinates.lng,
      host_id: userId,
    }).select().single();

    setLoading(false);

    if (error || !data) {
      toast({
        title: "Deploy failed",
        description: error?.message || "Failed to create spot",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Spot Created!",
      description: "Your spot is now live on the map.",
    });

    // Reset form
    setTitle('');
    setDescription('');
    setSelectedCategory(null);
    setSelectedActivity(null);
    setDate(undefined);
    setTime('18:00');
    setDuration(2);
    
    // Pass the created quest to parent for immediate state update
    onSuccess(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-primary/30 max-w-md max-h-[90vh] overflow-y-auto">
        {/* Tactical header */}
        <DialogHeader className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-warning/20 border-2 border-warning/40 shadow-hard-sm">
              <Compass className="w-6 h-6 text-warning" />
            </div>
            <div>
              <DialogTitle className="font-fredoka text-xl">
                Create Spot
              </DialogTitle>
              <p className="text-xs text-muted-foreground font-nunito mt-1">
                Start a new gathering
              </p>
            </div>
          </div>
          
          {/* Coordinates display */}
          {coordinates && (
            <div className={cn(
              "flex items-center gap-2 px-3 py-2 rounded border",
              isOutOfRange 
                ? "bg-destructive/10 border-destructive/50" 
                : "bg-muted/50 border-border/50"
            )}>
              <MapPin className={cn("w-4 h-4", isOutOfRange ? "text-destructive" : "text-primary")} />
              <span className={cn("font-nunito text-xs", isOutOfRange ? "text-destructive" : "text-muted-foreground")}>
                {coordinates.lat.toFixed(4)}, {coordinates.lng.toFixed(4)}
              </span>
              {isOutOfRange && (
                <span className="ml-auto text-xs font-semibold text-destructive">
                  {(distanceToTarget / 1000).toFixed(1)}km away
                </span>
              )}
            </div>
          )}
          
          {/* Out of range warning */}
          {isOutOfRange && (
            <div className="flex items-start gap-2 p-3 rounded bg-destructive/10 border border-destructive/30">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">
                <strong>Out of Range!</strong> You can only deploy megaphones within 5km of your current location.
              </p>
            </div>
          )}
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Title */}
          <div className="space-y-2">
            <Label className="font-nunito text-sm font-medium text-foreground">
              Spot Title
            </Label>
            <Input
              placeholder="e.g., Quick 3v3 Basketball"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-muted/50 border-2 border-border focus:border-primary rounded-xl"
            />
          </div>

          {/* Activity Selection - 2-Step */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="font-nunito text-sm font-medium text-foreground">
                Activity Type
              </Label>
              {(selectedCategory || selectedActivity) && (
                <button
                  onClick={handleBack}
                  className="text-xs text-primary hover:underline font-nunito font-medium"
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
                     <span className="font-nunito font-medium">{category.label}</span>
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
                  <span className="font-nunito">{selectedCategoryData?.label}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
                  {categoryActivities.map((activity) => (
                    <button
                      key={activity.id}
                      onClick={() => handleActivitySelect(activity.id)}
                      className={cn(
                        "flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all text-left",
                        "bg-muted/30 border-border hover:border-primary/50 hover:bg-primary/5"
                      )}
                    >
                      <span className="text-lg">{activity.icon}</span>
                      <span className="font-nunito text-sm truncate">{activity.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Date and Time Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="font-nunito text-sm font-medium text-foreground">
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
                    disabled={(d) => startOfDay(d) < startOfDay(new Date())}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="font-nunito text-sm font-medium text-foreground">
                Time
              </Label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                min={minTime}
                className="bg-muted/50 border-border/50"
              />
              {minTime && (
                <p className="text-[10px] text-muted-foreground">
                  Min: {minTime}
                </p>
              )}
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label className="font-nunito text-sm font-medium text-foreground flex items-center gap-1">
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

          {/* Description */}
          <div className="space-y-2">
            <Label className="font-nunito text-sm font-medium text-foreground">
              Description (optional)
            </Label>
            <Textarea
              placeholder="Add details about your spot..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-muted/50 border-2 border-border focus:border-primary rounded-xl min-h-[80px] resize-none"
              maxLength={500}
            />
            <p className="text-[10px] text-muted-foreground text-right">
              {description.length}/500
            </p>
          </div>

          {/* Warning - only show if in range */}
          {!isOutOfRange && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-warning/10 border-2 border-warning/30">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <p className="text-xs text-warning/80 font-nunito">
                Once created, your spot will be visible to everyone in the area.
              </p>
            </div>
          )}

          {/* Submit */}
          <Button 
            onClick={handleSubmit}
            disabled={loading || !selectedActivity || isOutOfRange}
            variant="warning"
            className={cn(
              "w-full min-h-[52px]",
              isOutOfRange && "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            {loading ? (
              <span className="animate-pulse">DEPLOYING...</span>
            ) : isOutOfRange ? (
              <>
                <AlertTriangle className="w-5 h-5 mr-2" />
                OUT OF RANGE
              </>
            ) : (
              <>
                <Compass className="w-5 h-5 mr-2" />
                DEPLOY QUEST
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeployQuestModal;
