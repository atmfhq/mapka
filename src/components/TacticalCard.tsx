import { cn } from "@/lib/utils";
import { ReactNode, CSSProperties } from "react";

interface TacticalCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: "cyan" | "magenta" | "lime";
  style?: CSSProperties;
}

const TacticalCard = ({ children, className, glowColor = "cyan", style }: TacticalCardProps) => {
  const glowClasses = {
    cyan: "hover:shadow-[0_0_30px_hsl(180_100%_50%_/_0.2)] hover:border-primary/50",
    magenta: "hover:shadow-[0_0_30px_hsl(320_100%_60%_/_0.2)] hover:border-accent/50",
    lime: "hover:shadow-[0_0_30px_hsl(120_100%_50%_/_0.2)] hover:border-success/50",
  };

  return (
    <div
      className={cn(
        "relative bg-card/50 backdrop-blur-sm border border-border rounded-lg p-6 transition-all duration-300",
        glowClasses[glowColor],
        className
      )}
      style={style}
    >
      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-4 h-4 border-l-2 border-t-2 border-primary/50 rounded-tl" />
      <div className="absolute top-0 right-0 w-4 h-4 border-r-2 border-t-2 border-primary/50 rounded-tr" />
      <div className="absolute bottom-0 left-0 w-4 h-4 border-l-2 border-b-2 border-primary/50 rounded-bl" />
      <div className="absolute bottom-0 right-0 w-4 h-4 border-r-2 border-b-2 border-primary/50 rounded-br" />
      
      {children}
    </div>
  );
};

export default TacticalCard;
