import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import LocationSearch from "@/components/LocationSearch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { broadcastCurrentUserUpdate } from "@/hooks/useProfilesRealtime";
import { MapPin, Loader2 } from "lucide-react";

interface RelocateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
  currentLocationName?: string;
  onLocationUpdated: (lat: number, lng: number, name: string) => void;
}

const RelocateModal = ({
  open,
  onOpenChange,
  currentUserId,
  currentLocationName,
  onLocationUpdated,
}: RelocateModalProps) => {
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lng: number;
    name: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleLocationSelect = (location: { lat: number; lng: number; name: string }) => {
    setSelectedLocation(location);
  };

  const handleConfirm = async () => {
    if (!selectedLocation) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          location_lat: selectedLocation.lat,
          location_lng: selectedLocation.lng,
          location_name: selectedLocation.name,
        })
        .eq("id", currentUserId);

      if (error) throw error;

      // Broadcast location update for real-time sync (includes full profile data)
      await broadcastCurrentUserUpdate(currentUserId, selectedLocation.lat, selectedLocation.lng, 'location_update');

      toast({
        title: "Location Updated",
        description: "Your base has been relocated",
      });

      onLocationUpdated(selectedLocation.lat, selectedLocation.lng, selectedLocation.name);
      onOpenChange(false);
      setSelectedLocation(null);
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.message || "Could not update location",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setSelectedLocation(null);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-orbitron">
            <MapPin className="w-5 h-5 text-primary" />
            Relocate Base
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Search for a new location to set as your base. Your map will fly to the new location.
          </p>

          <LocationSearch
            onLocationSelect={handleLocationSelect}
            initialValue={currentLocationName}
          />

          {selectedLocation && (
            <div className="p-3 bg-muted/30 rounded-lg border border-border">
              <div className="font-mono text-xs text-muted-foreground mb-1">
                New Location:
              </div>
              <div className="font-rajdhani text-sm text-foreground">
                {selectedLocation.name}
              </div>
              <div className="font-mono text-xs text-muted-foreground mt-1">
                {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleConfirm}
            disabled={!selectedLocation || saving}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <MapPin className="w-4 h-4" />
                Confirm Relocation
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RelocateModal;
