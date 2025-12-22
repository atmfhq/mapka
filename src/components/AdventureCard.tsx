import { cn } from "@/lib/utils";
import { ReactNode, CSSProperties } from "react";

interface AdventureCardProps {
  children: ReactNode;
  className?: string;
  color?: "forest" | "gold" | "berry" | "sky";
  style?: CSSProperties;
}

const AdventureCard = ({ children, className, color = "forest", style }: AdventureCardProps) => {
  const hoverClasses = {
    forest: "hover:border-primary/70 hover:bg-primary/5",
    gold: "hover:border-accent/70 hover:bg-accent/5",
    berry: "hover:border-pink-400/70 hover:bg-pink-400/5",
    sky: "hover:border-sky-400/70 hover:bg-sky-400/5",
  };

  return (
    <div
      className={cn(
        "relative bg-card border-3 border-border rounded-2xl p-6 transition-all duration-300 shadow-hard",
        hoverClasses[color],
        className
      )}
      style={style}
    >
      {children}
    </div>
  );
};

export default AdventureCard;