import { useEffect, useState, useCallback } from 'react';

interface Particle {
  id: number;
  emoji: string;
  x: number;
  y: number;
  rotation: number;
}

const FUN_EMOJIS = ['🎉', '🔥', '😜', '🚀', '👻', '✨', '💥', '⭐', '🌟', '💫'];

interface FloatingParticlesProps {
  trigger: number; // Increment this to spawn particles
  containerRef?: React.RefObject<HTMLElement>;
}

const FloatingParticles = ({ trigger, containerRef }: FloatingParticlesProps) => {
  const [particles, setParticles] = useState<Particle[]>([]);

  const spawnParticles = useCallback(() => {
    // Spawn 2-4 random emojis
    const count = 2 + Math.floor(Math.random() * 3);
    const newParticles: Particle[] = [];
    
    for (let i = 0; i < count; i++) {
      const emoji = FUN_EMOJIS[Math.floor(Math.random() * FUN_EMOJIS.length)];
      // Random position around center
      const x = -20 + Math.random() * 40; // -20px to +20px
      const y = 0;
      const rotation = -30 + Math.random() * 60; // -30deg to +30deg
      
      newParticles.push({
        id: Date.now() + i + Math.random(),
        emoji,
        x,
        y,
        rotation,
      });
    }
    
    setParticles(prev => [...prev, ...newParticles]);
    
    // Remove particles after animation
    setTimeout(() => {
      setParticles(prev => prev.filter(p => !newParticles.find(np => np.id === p.id)));
    }, 1200);
  }, []);

  useEffect(() => {
    if (trigger > 0) {
      spawnParticles();
    }
  }, [trigger, spawnParticles]);

  if (particles.length === 0) return null;

  return (
    <div 
      className="floating-particles-container"
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: 0,
        height: 0,
        pointerEvents: 'none',
        zIndex: 100,
      }}
    >
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="floating-particle"
          style={{
            position: 'absolute',
            left: particle.x,
            top: particle.y,
            fontSize: '24px',
            transform: `rotate(${particle.rotation}deg)`,
            animation: 'particle-float-up 1.2s ease-out forwards',
            willChange: 'transform, opacity',
          }}
        >
          {particle.emoji}
        </div>
      ))}
    </div>
  );
};

export default FloatingParticles;
