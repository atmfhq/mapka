import { useEffect, useState } from "react";

interface RadarBlip {
  id: number;
  x: number;
  y: number;
  size: number;
  color: "cyan" | "magenta" | "lime";
  delay: number;
}

const HeroRadar = () => {
  const [blips, setBlips] = useState<RadarBlip[]>([]);

  useEffect(() => {
    // Generate random blips for visual effect
    const generateBlips = () => {
      const newBlips: RadarBlip[] = [];
      const colors: ("cyan" | "magenta" | "lime")[] = ["cyan", "magenta", "lime"];
      
      for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 30 + Math.random() * 60; // 30-90% from center
        newBlips.push({
          id: i,
          x: 50 + Math.cos(angle) * distance * 0.4,
          y: 50 + Math.sin(angle) * distance * 0.4,
          size: 4 + Math.random() * 6,
          color: colors[Math.floor(Math.random() * colors.length)],
          delay: Math.random() * 2,
        });
      }
      setBlips(newBlips);
    };

    generateBlips();
  }, []);

  const colorClasses = {
    cyan: "bg-primary shadow-[0_0_10px_hsl(180_100%_50%)]",
    magenta: "bg-accent shadow-[0_0_10px_hsl(320_100%_60%)]",
    lime: "bg-success shadow-[0_0_10px_hsl(120_100%_50%)]",
  };

  return (
    <div className="relative w-full max-w-md aspect-square mx-auto">
      {/* Outer ring */}
      <div className="absolute inset-0 rounded-full border-2 border-primary/30" />
      
      {/* Middle ring */}
      <div className="absolute inset-[15%] rounded-full border border-primary/20" />
      
      {/* Inner ring */}
      <div className="absolute inset-[30%] rounded-full border border-primary/15" />
      
      {/* Center ring */}
      <div className="absolute inset-[45%] rounded-full border border-primary/10" />
      
      {/* Cross lines */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-full w-px bg-gradient-to-b from-transparent via-primary/20 to-transparent" />
      </div>
      
      {/* Sweep line with trailing glow */}
      <div className="absolute inset-0 radar-sweep">
        {/* Trailing fade effect - aligned to 90deg (right) where the line is */}
        <div 
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg at 50% 50%, transparent 0deg, transparent 30deg, hsl(180 100% 50% / 0.03) 45deg, hsl(180 100% 50% / 0.10) 70deg, hsl(180 100% 50% / 0.20) 89deg, transparent 90deg, transparent 360deg)",
          }}
        />
        {/* Main sweep line at 90deg (pointing right) */}
        <div 
          className="absolute top-1/2 left-1/2 w-1/2 h-0.5 -translate-y-1/2 origin-left"
          style={{
            background: "linear-gradient(90deg, hsl(180 100% 50% / 0.9), hsl(180 100% 50% / 0.3))",
            boxShadow: "0 0 8px hsl(180 100% 50% / 0.6)",
          }}
        />
      </div>
      
      {/* Blips */}
      {blips.map((blip) => (
        <div
          key={blip.id}
          className={`absolute rounded-full ${colorClasses[blip.color]} animate-pulse`}
          style={{
            left: `${blip.x}%`,
            top: `${blip.y}%`,
            width: blip.size,
            height: blip.size,
            transform: "translate(-50%, -50%)",
            animationDelay: `${blip.delay}s`,
          }}
        >
          {/* Pulse ring */}
          <div 
            className={`absolute inset-0 rounded-full ${colorClasses[blip.color]} animate-pulse-ring opacity-50`}
            style={{ animationDelay: `${blip.delay}s` }}
          />
        </div>
      ))}
      
      {/* Center dot (user) */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-4 h-4 rounded-full bg-primary shadow-[0_0_15px_hsl(180_100%_50%)] animate-pulse" />
      </div>
    </div>
  );
};

export default HeroRadar;
