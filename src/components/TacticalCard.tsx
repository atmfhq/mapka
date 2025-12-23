import { cn } from "@/lib/utils";
import { ReactNode, CSSProperties } from "react";

interface TacticalCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: "cyan" | "magenta" | "lime";
  style?: CSSProperties;
}

const TacticalCard = ({ children, className, style }: TacticalCardProps) => {
  return (
    <div
      className={cn(
        "relative bg-card border-3 border-border rounded-2xl p-6 shadow-hard transition-all duration-300 hover:translate-y-[-2px]",
        className
      )}
      style={style}
    >
      {children}
    </div>
  );
};

export default TacticalCard;
