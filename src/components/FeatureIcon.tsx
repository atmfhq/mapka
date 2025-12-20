import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeatureIconProps {
  icon: LucideIcon;
  color: "cyan" | "magenta" | "lime";
  size?: "sm" | "md" | "lg";
}

const FeatureIcon = ({ icon: Icon, color, size = "md" }: FeatureIconProps) => {
  const colorClasses = {
    cyan: "text-primary border-primary/30 bg-primary/10 shadow-[0_0_20px_hsl(180_100%_50%_/_0.2)]",
    magenta: "text-accent border-accent/30 bg-accent/10 shadow-[0_0_20px_hsl(320_100%_60%_/_0.2)]",
    lime: "text-success border-success/30 bg-success/10 shadow-[0_0_20px_hsl(120_100%_50%_/_0.2)]",
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
        "rounded-lg border flex items-center justify-center",
        colorClasses[color],
        sizeClasses[size]
      )}
    >
      <Icon size={iconSizes[size]} strokeWidth={1.5} />
    </div>
  );
};

export default FeatureIcon;
