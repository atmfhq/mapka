import { cn } from "@/lib/utils";

interface AvatarOption {
  id: string;
  url: string;
  label: string;
}

interface AvatarSelectorProps {
  options: AvatarOption[];
  selected: string | null;
  onSelect: (id: string) => void;
}

const AvatarSelector = ({ options, selected, onSelect }: AvatarSelectorProps) => {
  return (
    <div className="grid grid-cols-5 gap-3">
      {options.map((avatar) => (
        <button
          key={avatar.id}
          type="button"
          onClick={() => onSelect(avatar.id)}
          className={cn(
            "relative aspect-square rounded-lg border-2 overflow-hidden transition-all duration-300 group",
            selected === avatar.id
              ? "border-primary shadow-[0_0_20px_hsl(180_100%_50%_/_0.4)] scale-105"
              : "border-border hover:border-primary/50"
          )}
        >
          <img
            src={avatar.url}
            alt={avatar.label}
            className="w-full h-full object-cover"
          />
          {/* Selection indicator */}
          {selected === avatar.id && (
            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
              <div className="w-4 h-4 rounded-full bg-primary shadow-[0_0_10px_hsl(180_100%_50%)]" />
            </div>
          )}
          {/* Hover effect */}
          <div className={cn(
            "absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-1",
            selected === avatar.id && "opacity-100"
          )}>
            <span className="font-nunito text-[10px] text-primary">{avatar.label}</span>
          </div>
        </button>
      ))}
    </div>
  );
};

export default AvatarSelector;
