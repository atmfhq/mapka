import { cn } from "@/lib/utils";

interface StepperProps {
  currentStep: number;
  steps: { label: string; icon: React.ReactNode }[];
}

const TacticalStepper = ({ currentStep, steps }: StepperProps) => {
  return (
    <div className="flex items-center justify-center gap-4 mb-8">
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        
        return (
          <div key={index} className="flex items-center">
            {/* Step indicator */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-14 h-14 rounded-lg border-2 flex items-center justify-center transition-all duration-300",
                  isCompleted && "bg-primary border-primary text-primary-foreground shadow-[0_0_20px_hsl(180_100%_50%_/_0.5)]",
                  isCurrent && "bg-primary/20 border-primary text-primary animate-pulse shadow-[0_0_20px_hsl(180_100%_50%_/_0.3)]",
                  !isCompleted && !isCurrent && "bg-muted/50 border-border text-muted-foreground"
                )}
              >
                {step.icon}
              </div>
              <span
                className={cn(
                  "mt-2 font-mono text-xs uppercase tracking-wider",
                  isCurrent && "text-primary",
                  isCompleted && "text-primary",
                  !isCompleted && !isCurrent && "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
            
            {/* Connector line */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "w-16 h-0.5 mx-2 transition-all duration-300",
                  index < currentStep 
                    ? "bg-gradient-to-r from-primary to-primary shadow-[0_0_10px_hsl(180_100%_50%_/_0.5)]" 
                    : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TacticalStepper;
