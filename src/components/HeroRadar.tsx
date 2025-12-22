import { useEffect, useState } from "react";

interface RadarBlip {
  id: number;
  x: number;
  y: number;
  size: number;
  color: "forest" | "gold" | "berry" | "sky";
  delay: number;
}

const HeroRadar = () => {
  const [blips, setBlips] = useState<RadarBlip[]>([]);

  useEffect(() => {
    // Generate random blips for visual effect
    const generateBlips = () => {
      const newBlips: RadarBlip[] = [];
      const colors: ("forest" | "gold" | "berry" | "sky")[] = ["forest", "gold", "berry", "sky"];
      
      for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 30 + Math.random() * 60; // 30-90% from center
        newBlips.push({
          id: i,
          x: 50 + Math.cos(angle) * distance * 0.4,
          y: 50 + Math.sin(angle) * distance * 0.4,
          size: 8 + Math.random() * 8,
          color: colors[Math.floor(Math.random() * colors.length)],
          delay: Math.random() * 2,
        });
      }
      setBlips(newBlips);
    };

    generateBlips();
  }, []);

  const colorClasses = {
    forest: "bg-primary border-primary/50",
    gold: "bg-accent border-accent/50",
    berry: "bg-pink-400 border-pink-500",
    sky: "bg-sky-400 border-sky-500",
  };

  return (
    <div className="relative w-full max-w-md aspect-square mx-auto">
      {/* Outer ring - chunky adventure style */}
      <div className="absolute inset-0 rounded-full border-4 border-border bg-card/30" />
      
      {/* Middle ring */}
      <div className="absolute inset-[15%] rounded-full border-3 border-border/60" />
      
      {/* Inner ring */}
      <div className="absolute inset-[30%] rounded-full border-2 border-border/40" />
      
      {/* Center ring */}
      <div className="absolute inset-[45%] rounded-full border-2 border-border/30" />
      
      {/* Cross lines */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-full h-1 bg-gradient-to-r from-transparent via-border to-transparent rounded-full" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-full w-1 bg-gradient-to-b from-transparent via-border to-transparent rounded-full" />
      </div>
      
      {/* Sweep line with trailing effect */}
      <div className="absolute inset-0 radar-sweep">
        {/* Trailing fade effect */}
        <div 
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg at 50% 50%, transparent 0deg, transparent 30deg, hsl(var(--primary) / 0.05) 45deg, hsl(var(--primary) / 0.15) 70deg, hsl(var(--primary) / 0.25) 89deg, transparent 90deg, transparent 360deg)",
          }}
        />
        {/* Main sweep line */}
        <div 
          className="absolute top-1/2 left-1/2 w-1/2 h-1 -translate-y-1/2 origin-left rounded-full bg-primary"
        />
      </div>
      
      {/* Blips - chunky adventure style */}
      {blips.map((blip) => (
        <div
          key={blip.id}
          className={`absolute rounded-xl border-2 ${colorClasses[blip.color]} animate-pulse`}
          style={{
            left: `${blip.x}%`,
            top: `${blip.y}%`,
            width: blip.size,
            height: blip.size,
            transform: "translate(-50%, -50%)",
            animationDelay: `${blip.delay}s`,
          }}
        />
      ))}
      
      {/* Center dot (user) - adventure style */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-6 h-6 rounded-xl bg-primary border-3 border-primary-foreground shadow-hard-sm animate-pulse" />
      </div>
    </div>
  );
};

export default HeroRadar;