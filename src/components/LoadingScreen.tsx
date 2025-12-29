import { Target } from "lucide-react";

const LoadingScreen = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 pointer-events-none" />
      
      <div className="relative z-10 text-center">
        {/* Friendly loading animation */}
        <div className="relative w-32 h-32 mx-auto mb-8">
          {/* Outer ring */}
          <div className="absolute inset-0 rounded-full border-4 border-primary/30 animate-pulse" />
          
          {/* Middle ring */}
          <div className="absolute inset-4 rounded-full border-3 border-primary/20" />
          
          {/* Inner ring */}
          <div className="absolute inset-8 rounded-full border-2 border-primary/15" />
          
          {/* Center icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-14 h-14 rounded-xl bg-primary/20 border-3 border-primary/40 flex items-center justify-center shadow-hard animate-bounce-in">
              <Target className="w-7 h-7 text-primary" />
            </div>
          </div>
        </div>
        
        {/* Loading text */}
        <div className="font-fredoka text-2xl font-bold mb-2">
          Map<span className="text-primary">ka</span>
        </div>
        <div className="font-nunito text-sm text-muted-foreground animate-pulse">
          Loading your adventure...
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
