import { cn } from "@/lib/utils";

interface InterestChipProps {
  label: string;
  icon: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}

const InterestChip = ({ label, icon, selected, disabled, onClick }: InterestChipProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled && !selected}
      className={cn(
        "flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all duration-300 font-nunito font-bold",
        selected && "bg-primary/20 border-primary text-primary shadow-hard-sm",
        !selected && !disabled && "bg-muted/30 border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
        disabled && !selected && "opacity-40 cursor-not-allowed"
      )}
    >
      <span className="text-lg">{icon}</span>
      <span>{label}</span>
    </button>
  );
};

export default InterestChip;
