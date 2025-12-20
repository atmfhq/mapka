import { Target } from "lucide-react";

const LoadingScreen = () => {
  return (
    <div className="min-h-screen bg-background tactical-grid flex items-center justify-center">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
      
      <div className="relative z-10 text-center">
        {/* Spinning radar effect */}
        <div className="relative w-32 h-32 mx-auto mb-8">
          {/* Outer ring */}
          <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-pulse" />
          
          {/* Middle ring */}
          <div className="absolute inset-4 rounded-full border border-primary/20" />
          
          {/* Inner ring */}
          <div className="absolute inset-8 rounded-full border border-primary/15" />
          
          {/* Sweep line */}
          <div className="absolute inset-0 radar-sweep">
            <div 
              className="absolute top-1/2 left-1/2 w-1/2 h-0.5 origin-left"
              style={{
                background: "linear-gradient(90deg, hsl(180 100% 50% / 0.8), transparent)",
              }}
            />
          </div>
          
          {/* Center icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center animate-pulse">
              <Target className="w-6 h-6 text-primary" />
            </div>
          </div>
        </div>
        
        {/* Loading text */}
        <div className="font-orbitron text-xl font-bold mb-2">
          SQUAD<span className="text-primary">MAP</span>
        </div>
        <div className="font-mono text-sm text-muted-foreground uppercase tracking-widest animate-pulse">
          Establishing Connection...
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
