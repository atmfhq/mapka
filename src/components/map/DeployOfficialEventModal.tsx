import { useState, useMemo, useEffect, useRef } from 'react';
import { format, startOfDay, isToday } from 'date-fns';
import { CalendarIcon, Clock, MapPin, AlertTriangle, Crown, Link as LinkIcon, Building2, MapPinned, Image, Upload } from 'lucide-react';
import ImageCropper from '@/components/ui/ImageCropper';
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

// Cover Image Uploader Component with square cropping
const CoverImageUploader = ({ 
  coverImageUrl, 
  onImageChange 
}: { 
  coverImageUrl: string; 
  onImageChange: (url: string) => void;
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);
  const [cropperOpen, setCropperOpen] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return;
    }

    // Create data URL for cropping
    const reader = new FileReader();
    reader.onload = (event) => {
      setTempImageSrc(event.target?.result as string);
      setCropperOpen(true);
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleCropComplete = (croppedImageUrl: string) => {
    onImageChange(croppedImageUrl);
    setTempImageSrc(null);
  };

  const handleRemoveImage = () => {
    onImageChange('');
  };

  return (
    <div className="space-y-2">
      <Label className="font-nunito text-sm font-medium text-foreground flex items-center gap-1">
        <Image className="w-3 h-3" /> Cover Image (Square)
      </Label>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {coverImageUrl ? (
        <div className="relative">
          <div className="w-full aspect-square rounded-xl overflow-hidden border-2 border-border bg-muted/50">
            <img 
              src={coverImageUrl} 
              alt="Cover preview" 
              className="w-full h-full object-cover"
            />
          </div>
          <div className="absolute top-2 right-2 flex gap-1">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              className="h-8 px-2 bg-background/80 backdrop-blur-sm"
            >
              <Upload className="w-3 h-3 mr-1" />
              Replace
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={handleRemoveImage}
              className="h-8 px-2"
            >
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-32 border-2 border-dashed border-border hover:border-primary flex flex-col items-center justify-center gap-2 bg-muted/30"
        >
          <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center">
            <Upload className="w-6 h-6 text-muted-foreground" />
          </div>
          <span className="text-sm text-muted-foreground">Click to upload image</span>
          <span className="text-xs text-muted-foreground/60">Will be cropped to 1:1 square</span>
        </Button>
      )}
      
      <p className="text-[10px] text-muted-foreground">
        Image will be displayed on the map marker and event details
      </p>

      {/* Image Cropper Modal */}
      {tempImageSrc && (
        <ImageCropper
          open={cropperOpen}
          onOpenChange={(open) => {
            setCropperOpen(open);
            if (!open) setTempImageSrc(null);
          }}
          imageSrc={tempImageSrc}
          onCropComplete={handleCropComplete}
          aspectRatio={1}
        />
      )}
    </div>
  );
};

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
  description?: string | null;
  cover_image_url?: string | null;
  organizer_display_name?: string | null;
  external_link?: string | null;
  location_details?: string | null;
}

interface DeployOfficialEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coordinates: { lat: number; lng: number } | null;
  userId: string;
  userBaseLat: number;
  userBaseLng: number;
  onSuccess: (quest: Quest) => void;
  editQuest?: Quest | null; // For edit mode
}

const DeployOfficialEventModal = ({ 
  open, 
  onOpenChange, 
  coordinates, 
  userId,
  userBaseLat,
  userBaseLng,
  onSuccess,
  editQuest
}: DeployOfficialEventModalProps) => {
  const isEditMode = !!editQuest;
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

  // Pre-fill form when editing
  useEffect(() => {
    if (editQuest && open) {
      const startTime = new Date(editQuest.start_time);
      setTitle(editQuest.title);
      setDescription(editQuest.description || '');
      setSelectedIcon(editQuest.category || '');
      setDate(startTime);
      setTime(format(startTime, 'HH:mm'));
      setDuration(editQuest.duration_minutes / 60);
      setCoverImageUrl(editQuest.cover_image_url || '');
      setOrganizerDisplayName(editQuest.organizer_display_name || '');
      setExternalLink(editQuest.external_link || '');
      setLocationDetails(editQuest.location_details || '');
    }
  }, [editQuest, open]);

  // Reset form when modal closes (only if not editing)
  useEffect(() => {
    if (!open && !editQuest) {
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
    }
  }, [open, editQuest]);

  // For edit mode, use the quest's coordinates; otherwise use clicked coordinates
  const effectiveCoordinates = isEditMode 
    ? { lat: editQuest!.lat, lng: editQuest!.lng } 
    : coordinates;

  // Calculate distance from user's base to target coordinates
  const distanceToTarget = useMemo(() => {
    if (!effectiveCoordinates) return 0;
    return calculateDistanceMeters(userBaseLat, userBaseLng, effectiveCoordinates.lat, effectiveCoordinates.lng);
  }, [effectiveCoordinates, userBaseLat, userBaseLng]);

  const isOutOfRange = distanceToTarget > MAX_RANGE_METERS;

  // Helper function to upload base64 image to storage
  const uploadImageToStorage = async (base64Data: string): Promise<string | null> => {
    try {
      // Convert base64 to blob
      const response = await fetch(base64Data);
      const blob = await response.blob();
      
      // Generate unique filename
      const fileExt = blob.type.split('/')[1] || 'png';
      const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      // Upload to storage
      const { data, error } = await supabase.storage
        .from('official-event-images')
        .upload(fileName, blob, {
          contentType: blob.type,
          upsert: false
        });
      
      if (error) {
        console.error('Upload error:', error);
        return null;
      }
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('official-event-images')
        .getPublicUrl(data.path);
      
      return urlData.publicUrl;
    } catch (err) {
      console.error('Image upload failed:', err);
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!title || !selectedIcon || !date || !effectiveCoordinates) {
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

    // Only validate future time for new events, not edits
    if (!isEditMode && startTime <= new Date()) {
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

    setLoading(true);

    // Handle image upload if it's a base64 data URL
    let finalImageUrl = coverImageUrl.trim() || null;
    if (coverImageUrl && coverImageUrl.startsWith('data:')) {
      const uploadedUrl = await uploadImageToStorage(coverImageUrl);
      if (!uploadedUrl) {
        toast({
          title: "Image upload failed",
          description: "Could not upload the cover image. Please try again.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      finalImageUrl = uploadedUrl;
    }
    
    const eventData = {
      title,
      description: description.trim() || null,
      category: selectedIcon,
      start_time: startTime.toISOString(),
      duration_minutes: duration * 60,
      cover_image_url: finalImageUrl,
      organizer_display_name: organizerDisplayName.trim() || null,
      external_link: externalLink.trim() || null,
      location_details: locationDetails.trim() || null,
    };

    let data;
    let error;

    if (isEditMode) {
      // Update existing event
      const result = await supabase
        .from('megaphones')
        .update(eventData)
        .eq('id', editQuest!.id)
        .select()
        .single();
      data = result.data;
      error = result.error;
    } else {
      // Create new event
      const insertData = {
        ...eventData,
        lat: effectiveCoordinates.lat,
        lng: effectiveCoordinates.lng,
        host_id: userId,
        is_official: true,
      };
      
      const result = await supabase
        .from('megaphones')
        .insert(insertData as typeof insertData & { share_code: string })
        .select()
        .single();
      data = result.data;
      error = result.error;
    }

    setLoading(false);

    if (error || !data) {
      toast({
        title: isEditMode ? "Update failed" : "Deploy failed",
        description: error?.message || `Failed to ${isEditMode ? 'update' : 'create'} official event`,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: isEditMode ? "Official Event Updated!" : "Official Event Created!",
      description: isEditMode 
        ? "Your changes have been saved." 
        : "Your official event is now live on the map.",
    });

    // Reset form only if creating new (edit mode handles cleanup differently)
    if (!isEditMode) {
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
    }
    
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
                {isEditMode ? 'Edit Official Event' : 'Official Event'}
                <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-600 rounded-full border border-amber-500/30">
                  ADMIN
                </span>
              </DialogTitle>
              <p className="text-xs text-muted-foreground font-nunito mt-1">
                {isEditMode ? 'Update your verified event' : 'Create a verified community event'}
              </p>
            </div>
          </div>
          
          {/* Coordinates display */}
          {effectiveCoordinates && (
            <div className={cn(
              "flex items-center gap-2 px-3 py-2 rounded border",
              isOutOfRange 
                ? "bg-destructive/10 border-destructive/50" 
                : "bg-muted/50 border-border/50"
            )}>
              <MapPin className={cn("w-4 h-4", isOutOfRange ? "text-destructive" : "text-primary")} />
              <span className={cn("font-nunito text-xs", isOutOfRange ? "text-destructive" : "text-muted-foreground")}>
                {effectiveCoordinates.lat.toFixed(4)}, {effectiveCoordinates.lng.toFixed(4)}
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

          {/* Cover Image Upload with Cropping */}
          <CoverImageUploader 
            coverImageUrl={coverImageUrl}
            onImageChange={setCoverImageUrl}
          />

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
              <span className="animate-pulse">{isEditMode ? 'UPDATING...' : 'CREATING...'}</span>
            ) : isOutOfRange ? (
              <>
                <AlertTriangle className="w-5 h-5 mr-2" />
                OUT OF RANGE
              </>
            ) : (
              <>
                <Crown className="w-5 h-5 mr-2" />
                {isEditMode ? 'UPDATE OFFICIAL EVENT' : 'CREATE OFFICIAL EVENT'}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeployOfficialEventModal;
