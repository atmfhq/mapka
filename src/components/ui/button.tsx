import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-base font-nunito font-bold tracking-wide ring-offset-background transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0 border-2 border-border",
  {
    variants: {
      variant: {
        // Primary - RPG Green block button with visible dark bottom stroke
        default:
          "bg-primary text-primary-foreground border-border shadow-[0_4px_0_0_hsl(122_39%_30%)] hover:bg-primary/90 active:translate-y-1 active:shadow-none",
        // Destructive - Red block button
        destructive:
          "bg-destructive text-destructive-foreground border-border shadow-[0_4px_0_0_hsl(0_50%_35%)] hover:bg-destructive/90 active:translate-y-1 active:shadow-none",
        // Outline - Parchment style
        outline:
          "bg-card text-foreground border-border shadow-hard hover:bg-secondary active:translate-y-1 active:shadow-none",
        // Secondary - Stone/Wood style  
        secondary:
          "bg-secondary text-secondary-foreground border-border shadow-[0_4px_0_0_hsl(30_20%_55%)] hover:bg-secondary/80 active:translate-y-1 active:shadow-none",
        // Ghost - Minimal
        ghost:
          "border-transparent hover:bg-muted hover:text-foreground shadow-none",
        // Link - Text only
        link:
          "text-primary underline-offset-4 hover:underline border-transparent shadow-none",
        // Adventure variants - Colorful candy buttons with dark bottom strokes
        gold:
          "bg-accent text-accent-foreground border-border shadow-[0_4px_0_0_hsl(45_80%_35%)] hover:bg-accent/90 active:translate-y-1 active:shadow-none",
        forest:
          "bg-success text-success-foreground border-border shadow-[0_4px_0_0_hsl(142_50%_30%)] hover:bg-success/90 active:translate-y-1 active:shadow-none",
        warning:
          "bg-warning text-warning-foreground border-border shadow-[0_4px_0_0_hsl(35_70%_35%)] hover:bg-warning/90 active:translate-y-1 active:shadow-none",
        // HUD style - Floating inventory bar look
        hud:
          "bg-card/95 backdrop-blur-sm border-2 text-foreground hover:bg-card shadow-hard active:translate-y-1 active:shadow-none",
      },
      size: {
        default: "h-12 px-6 py-2",
        sm: "h-10 rounded-lg px-4 text-sm",
        lg: "h-14 rounded-xl px-8 text-lg",
        xl: "h-16 rounded-2xl px-10 text-xl",
        icon: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };