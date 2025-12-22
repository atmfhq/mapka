import { cn } from "@/lib/utils";

interface StepperProps {
  currentStep: number;
  steps: { label: string; icon: React.ReactNode }[];
}

const AdventureStepper = ({ currentStep, steps }: StepperProps) => {
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
                  "w-14 h-14 rounded-xl border-3 flex items-center justify-center transition-all duration-300",
                  isCompleted && "bg-primary border-primary/70 text-primary-foreground shadow-hard-sm",
                  isCurrent && "bg-primary/20 border-primary text-primary shadow-hard-sm animate-bounce-soft",
                  !isCompleted && !isCurrent && "bg-muted/50 border-border text-muted-foreground"
                )}
              >
                {step.icon}
              </div>
              <span
                className={cn(
                  "mt-2 font-nunito text-xs font-bold uppercase tracking-wider",
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
                  "w-16 h-1 mx-2 rounded-full transition-all duration-300",
                  index < currentStep 
                    ? "bg-primary" 
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

export default AdventureStepper;