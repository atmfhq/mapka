import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface MapHUDControlsProps {
  onRelocateClick: () => void;
}

const MapHUDControls = ({ onRelocateClick }: MapHUDControlsProps) => {
  return (
    <div className="absolute bottom-[180px] right-4 z-20 flex flex-col gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={onRelocateClick}
            className="w-10 h-10 bg-card/90 backdrop-blur-sm border-border hover:bg-card hover:border-primary"
          >
            <MapPin className="w-5 h-5 text-primary" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>Relocate Base</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
};

export default MapHUDControls;
