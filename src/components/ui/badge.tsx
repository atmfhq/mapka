import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-xl border-2 px-3 py-1 text-sm font-nunito font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-primary/50 bg-primary text-primary-foreground",
        secondary: "border-secondary/50 bg-secondary text-secondary-foreground",
        destructive: "border-destructive/50 bg-destructive text-destructive-foreground",
        outline: "border-border bg-card text-foreground",
        // Adventure candy colors
        forest: "border-success/50 bg-success text-success-foreground",
        gold: "border-accent/50 bg-accent text-accent-foreground",
        sky: "border-sky-500 bg-sky-400 text-sky-900",
        berry: "border-pink-500 bg-pink-400 text-pink-900",
        earth: "border-earth bg-earth text-amber-100",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };