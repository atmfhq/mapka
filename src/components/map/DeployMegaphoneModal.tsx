import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Megaphone, Users, Clock, MapPin, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface DeployMegaphoneModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coordinates: { lat: number; lng: number } | null;
  userId: string;
  onSuccess: () => void;
}

const CATEGORIES = [
  { value: 'Sport', label: 'Sport', color: 'hsl(15 100% 55%)' },
  { value: 'Gaming', label: 'Gaming', color: 'hsl(180 100% 50%)' },
  { value: 'Food', label: 'Food', color: 'hsl(45 100% 55%)' },
  { value: 'Party', label: 'Party', color: 'hsl(320 100% 60%)' },
  { value: 'Other', label: 'Other', color: 'hsl(215 20% 55%)' },
];

const DeployMegaphoneModal = ({ 
  open, 
  onOpenChange, 
  coordinates, 
  userId, 
  onSuccess 
}: DeployMegaphoneModalProps) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState('18:00');
  const [maxParticipants, setMaxParticipants] = useState(4);
  const [duration, setDuration] = useState(2);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!title || !category || !date || !coordinates) {
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

    const { error } = await supabase.from('megaphones').insert({
      title,
      category,
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
    setCategory('');
    setDate(undefined);
    setTime('18:00');
    setMaxParticipants(4);
    setDuration(2);
    onSuccess();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-primary/30 max-w-md">
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

          {/* Category */}
          <div className="space-y-2">
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Category
            </Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="bg-muted/50 border-border/50">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: cat.color }}
                      />
                      {cat.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            disabled={loading}
            className="w-full bg-warning hover:bg-warning/90 text-warning-foreground font-orbitron tracking-wider"
          >
            {loading ? (
              <span className="animate-pulse">DEPLOYING...</span>
            ) : (
              <>
                <Megaphone className="w-4 h-4 mr-2" />
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
