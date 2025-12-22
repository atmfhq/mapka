import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeatureIconProps {
  icon: LucideIcon;
  color: "forest" | "gold" | "berry" | "sky";
  size?: "sm" | "md" | "lg";
}

const FeatureIcon = ({ icon: Icon, color, size = "md" }: FeatureIconProps) => {
  const colorClasses = {
    forest: "text-primary border-primary/50 bg-primary/10",
    gold: "text-accent border-accent/50 bg-accent/10",
    berry: "text-pink-500 border-pink-400/50 bg-pink-400/10",
    sky: "text-sky-500 border-sky-400/50 bg-sky-400/10",
  };

  const sizeClasses = {
    sm: "w-10 h-10 p-2",
    md: "w-14 h-14 p-3",
    lg: "w-20 h-20 p-5",
  };

  const iconSizes = {
    sm: 20,
    md: 28,
    lg: 40,
  };

  return (
    <div
      className={cn(
        "rounded-xl border-3 border-border flex items-center justify-center shadow-hard-sm",
        colorClasses[color],
        sizeClasses[size]
      )}
    >
      <Icon size={iconSizes[size]} strokeWidth={2} />
    </div>
  );
};

export default FeatureIcon;