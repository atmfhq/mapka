import { useState, useMemo, useEffect } from 'react';
import { format, startOfDay, isToday } from 'date-fns';
import { CalendarIcon, Clock, MapPin, AlertTriangle, Crown, Link as LinkIcon, Building2, MapPinned, Image } from 'lucide-react';
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
import EmojiPicker from '@/components/ui/EmojiPicker';

// Get minimum time for today (current time + 15 min buffer, rounded up to next 5 min)
const getMinTimeForToday = (): string => {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 15);
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
  const R = 6371000;
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

const MAX_RANGE_METERS = 50000; // 50km range for official events (admins get extended range)

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
  is_official?: boolean;
}

interface DeployOfficialEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coordinates: { lat: number; lng: number } | null;
  userId: string;
  userBaseLat: number;
  userBaseLng: number;
  onSuccess: (quest: Quest) => void;
}

const DeployOfficialEventModal = ({ 
  open, 
  onOpenChange, 
  coordinates, 
  userId,
  userBaseLat,
  userBaseLng,
  onSuccess 
}: DeployOfficialEventModalProps) => {
  // Standard fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIcon, setSelectedIcon] = useState<string>('');
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState('18:00');
  const [duration, setDuration] = useState(2);
  const [loading, setLoading] = useState(false);

  // Official event fields
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [organizerDisplayName, setOrganizerDisplayName] = useState('');
  const [externalLink, setExternalLink] = useState('');
  const [locationDetails, setLocationDetails] = useState('');

  // Calculate min time based on selected date
  const minTime = useMemo(() => {
    if (!date) return undefined;
    if (isToday(date)) {
      return getMinTimeForToday();
    }
    return undefined;
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

  // Calculate distance from user's base to clicked coordinates
  const distanceToTarget = useMemo(() => {
    if (!coordinates) return 0;
    return calculateDistanceMeters(userBaseLat, userBaseLng, coordinates.lat, coordinates.lng);
  }, [coordinates, userBaseLat, userBaseLng]);

  const isOutOfRange = distanceToTarget > MAX_RANGE_METERS;

  const handleSubmit = async () => {
    if (!title || !selectedIcon || !date || !coordinates) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    if (isOutOfRange) {
      toast({
        title: "Out of Range!",
        description: "You can only place official events within 50km of your location.",
        variant: "destructive",
      });
      return;
    }

    // Combine date and time
    const [hours, minutes] = time.split(':').map(Number);
    const startTime = new Date(date);
    startTime.setHours(hours, minutes, 0, 0);

    if (startTime <= new Date()) {
      toast({
        title: "Invalid time",
        description: "Event start time must be in the future.",
        variant: "destructive",
      });
      return;
    }

    if (duration > 24) {
      toast({
        title: "Duration too long",
        description: "Event cannot last longer than 24 hours.",
        variant: "destructive",
      });
      return;
    }

    // Validate external link if provided
    if (externalLink && !externalLink.match(/^https?:\/\/.+/)) {
      toast({
        title: "Invalid link",
        description: "External link must start with http:// or https://",
        variant: "destructive",
      });
      return;
    }

    // Validate cover image URL if provided
    if (coverImageUrl && !coverImageUrl.match(/^https?:\/\/.+/)) {
      toast({
        title: "Invalid image URL",
        description: "Cover image URL must start with http:// or https://",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    const insertData = {
      title,
      description: description.trim() || null,
      category: selectedIcon,
      start_time: startTime.toISOString(),
      duration_minutes: duration * 60,
      lat: coordinates.lat,
      lng: coordinates.lng,
      host_id: userId,
      is_official: true,
      cover_image_url: coverImageUrl.trim() || null,
      organizer_display_name: organizerDisplayName.trim() || null,
      external_link: externalLink.trim() || null,
      location_details: locationDetails.trim() || null,
    };
    
    const { data, error } = await supabase
      .from('megaphones')
      .insert(insertData as typeof insertData & { share_code: string })
      .select()
      .single();

    setLoading(false);

    if (error || !data) {
      toast({
        title: "Deploy failed",
        description: error?.message || "Failed to create official event",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Official Event Created!",
      description: "Your official event is now live on the map.",
    });

    // Reset form
    setTitle('');
    setDescription('');
    setSelectedIcon('');
    setDate(undefined);
    setTime('18:00');
    setDuration(2);
    setCoverImageUrl('');
    setOrganizerDisplayName('');
    setExternalLink('');
    setLocationDetails('');
    
    onSuccess(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-primary/30 max-w-md w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto overflow-x-hidden px-5">
        {/* Official Event Header */}
        <DialogHeader className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-yellow-500/20 border-2 border-amber-500/40 shadow-hard-sm">
              <Crown className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <DialogTitle className="font-fredoka text-xl flex items-center gap-2">
                Official Event
                <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-600 rounded-full border border-amber-500/30">
                  ADMIN
                </span>
              </DialogTitle>
              <p className="text-xs text-muted-foreground font-nunito mt-1">
                Create a verified community event
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
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Title */}
          <div className="space-y-2">
            <Label className="font-nunito text-sm font-medium text-foreground">
              Event Title *
            </Label>
            <Input
              placeholder="e.g., City Summer Festival 2025"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-muted/50 border-2 border-border focus:border-primary rounded-xl"
            />
          </div>

          {/* Icon Selection */}
          <div className="space-y-2">
            <Label className="font-nunito text-sm font-medium text-foreground">
              Icon *
            </Label>
            <EmojiPicker 
              value={selectedIcon} 
              onChange={setSelectedIcon} 
            />
          </div>

          {/* Organizer Display Name */}
          <div className="space-y-2">
            <Label className="font-nunito text-sm font-medium text-foreground flex items-center gap-1">
              <Building2 className="w-3 h-3" /> Organizer Name
            </Label>
            <Input
              placeholder="e.g., City Hall, Local Sports Club"
              value={organizerDisplayName}
              onChange={(e) => setOrganizerDisplayName(e.target.value)}
              className="bg-muted/50 border-2 border-border focus:border-primary rounded-xl"
            />
            <p className="text-[10px] text-muted-foreground">
              Overrides your profile name in the event display
            </p>
          </div>

          {/* Cover Image URL */}
          <div className="space-y-2">
            <Label className="font-nunito text-sm font-medium text-foreground flex items-center gap-1">
              <Image className="w-3 h-3" /> Cover Image URL
            </Label>
            <Input
              placeholder="https://example.com/event-banner.jpg"
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              className="bg-muted/50 border-2 border-border focus:border-primary rounded-xl"
            />
            {coverImageUrl && coverImageUrl.match(/^https?:\/\/.+/) && (
              <div className="rounded-lg overflow-hidden border border-border">
                <img 
                  src={coverImageUrl} 
                  alt="Cover preview" 
                  className="w-full h-32 object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>

          {/* Date and Time Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="font-nunito text-sm font-medium text-foreground">
                Date *
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
                Time *
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
              <Clock className="w-3 h-3" /> Duration (hrs) *
            </Label>
            <Input
              type="number"
              min={0.5}
              max={24}
              step={0.5}
              value={duration}
              onChange={(e) => {
                const val = Number(e.target.value);
                setDuration(Math.min(val, 24));
              }}
              className="bg-muted/50 border-border/50"
            />
          </div>

          {/* Location Details */}
          <div className="space-y-2">
            <Label className="font-nunito text-sm font-medium text-foreground flex items-center gap-1">
              <MapPinned className="w-3 h-3" /> Location Details
            </Label>
            <Input
              placeholder="e.g., VIP Entrance, Gate B, 2nd Floor"
              value={locationDetails}
              onChange={(e) => setLocationDetails(e.target.value)}
              className="bg-muted/50 border-2 border-border focus:border-primary rounded-xl"
            />
          </div>

          {/* External Link */}
          <div className="space-y-2">
            <Label className="font-nunito text-sm font-medium text-foreground flex items-center gap-1">
              <LinkIcon className="w-3 h-3" /> External Link
            </Label>
            <Input
              placeholder="https://tickets.example.com/event"
              value={externalLink}
              onChange={(e) => setExternalLink(e.target.value)}
              className="bg-muted/50 border-2 border-border focus:border-primary rounded-xl"
            />
            <p className="text-[10px] text-muted-foreground">
              Link for tickets or more information
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label className="font-nunito text-sm font-medium text-foreground">
              Description
            </Label>
            <Textarea
              placeholder="Add details about your official event..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-muted/50 border-2 border-border focus:border-primary rounded-xl min-h-[80px] resize-none"
              maxLength={1000}
            />
            <p className="text-[10px] text-muted-foreground text-right">
              {description.length}/1000
            </p>
          </div>

          {/* Info notice */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border-2 border-amber-500/30">
            <Crown className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-600 font-nunito">
              Official events are marked with a verified badge and may be featured prominently.
            </p>
          </div>

          {/* Submit */}
          <Button 
            onClick={handleSubmit}
            disabled={loading || !selectedIcon || isOutOfRange}
            className={cn(
              "w-full min-h-[52px] bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white",
              isOutOfRange && "bg-muted text-muted-foreground cursor-not-allowed from-muted to-muted"
            )}
          >
            {loading ? (
              <span className="animate-pulse">CREATING...</span>
            ) : isOutOfRange ? (
              <>
                <AlertTriangle className="w-5 h-5 mr-2" />
                OUT OF RANGE
              </>
            ) : (
              <>
                <Crown className="w-5 h-5 mr-2" />
                CREATE OFFICIAL EVENT
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeployOfficialEventModal;
