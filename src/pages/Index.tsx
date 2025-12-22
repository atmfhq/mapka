import { Button } from "@/components/ui/button";
import HeroRadar from "@/components/HeroRadar";
import TacticalCard from "@/components/TacticalCard";
import FeatureIcon from "@/components/FeatureIcon";
import { MapPin, Users, Radio, Gamepad2, Target, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  // Determine where to navigate based on auth state
  const getAppLink = () => {
    if (!user) return "/auth";
    if (profile && !profile.is_onboarded) return "/onboarding";
    return "/dashboard";
  };
  const handleWatchDemo = () => {
    toast({
      title: "Coming Soon",
      description: "Demo video is under production. Stay tuned!"
    });
  };
  return <div className="min-h-screen bg-background tactical-grid relative overflow-hidden">
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
      
      {/* Top HUD bar */}
      <header className="relative z-10 border-b border-border/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <span className="font-orbitron text-xl font-bold text-foreground tracking-wider">
              SQUAD<span className="text-primary">MAP</span>
            </span>
          </div>
          
          <nav className="hidden md:flex items-center gap-6">
            <span className="text-muted-foreground font-mono text-sm uppercase tracking-widest">
              v1.0 tactical beta 
            </span>
          </nav>
          
          <div className="flex items-center gap-3">
            {user ? <Link to={getAppLink()}>
                <Button variant="neonCyan" size="sm">
                  Dashboard
                </Button>
              </Link> : <>
                <Link to="/auth">
                  <Button variant="ghost" size="sm" className="font-mono">
                    Login
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button variant="neonCyan" size="sm">
                    Deploy
                  </Button>
                </Link>
              </>}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 container mx-auto px-4 py-16 md:py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/5">
              <Radio className="w-4 h-4 text-primary animate-pulse" />
              <span className="font-mono text-sm text-primary uppercase tracking-wider">
                Social Locator Online
              </span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-orbitron font-bold leading-tight">
              <span className="text-foreground">Find Your</span>
              <br />
              <span className="text-primary text-glow-cyan">Squad</span>
              <span className="text-foreground">.</span>
              <br />
              <span className="text-accent text-glow-magenta">Go Offline</span>
              <span className="text-foreground">.</span>
            </h1>
            
            <p className="text-lg text-muted-foreground max-w-lg font-rajdhani leading-relaxed">
              A tactical map for finding real people. See who's nearby, 
              discover activities, and turn online connections into offline adventures.
              <span className="text-primary"> See → Click → Go.</span>
            </p>
            
            <div className="flex flex-wrap gap-4">
              <Link to={getAppLink()}>
                <Button variant="solidCyan" size="xl" className="group">
                  <MapPin className="w-5 h-5 group-hover:animate-pulse" />
                  Enter The Map
                </Button>
              </Link>
              <Button variant="outline" size="xl" onClick={handleWatchDemo}>
                <Gamepad2 className="w-5 h-5" />
                Watch Demo
              </Button>
            </div>
            
            {/* Stats */}
            <div className="flex gap-8 pt-4">
              <div className="text-center">
                <div className="font-orbitron text-2xl font-bold text-primary">∞</div>
                <div className="font-mono text-xs text-muted-foreground uppercase">Connections</div>
              </div>
              <div className="text-center">
                <div className="font-orbitron text-2xl font-bold text-accent">24/7</div>
                <div className="font-mono text-xs text-muted-foreground uppercase">Live Map</div>
              </div>
              <div className="text-center">
                <div className="font-orbitron text-2xl font-bold text-success">0</div>
                <div className="font-mono text-xs text-muted-foreground uppercase">BS Factor</div>
              </div>
            </div>
          </div>
          
          {/* Radar visualization */}
          <div className="relative animate-fade-in-up delay-200 opacity-0" style={{
          animationFillMode: 'forwards'
        }}>
            <HeroRadar />
            
            {/* Floating labels */}
            <div className="absolute top-[15%] right-[10%] px-3 py-1 rounded bg-card/80 backdrop-blur border border-primary/30 font-mono text-xs text-primary animate-float">
              @runner_pro
            </div>
            <div className="absolute bottom-[25%] left-[5%] px-3 py-1 rounded bg-card/80 backdrop-blur border border-accent/30 font-mono text-xs text-accent animate-float" style={{
            animationDelay: '0.5s'
          }}>
              🎮 Gaming Night
            </div>
            <div className="absolute top-[40%] right-[5%] px-3 py-1 rounded bg-card/80 backdrop-blur border border-success/30 font-mono text-xs text-success animate-float" style={{
            animationDelay: '1s'
          }}>
              ⚽ 3v3 Match
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative z-10 container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="font-orbitron text-3xl font-bold mb-4">
            <span className="text-muted-foreground">Mission</span>{" "}
            <span className="text-primary">Control</span>
          </h2>
          <p className="text-muted-foreground font-rajdhani max-w-xl mx-auto">
            Everything you need to coordinate with your squad
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-6">
          <TacticalCard glowColor="cyan" className="animate-fade-in-up delay-100 opacity-0" style={{
          animationFillMode: 'forwards'
        }}>
            <FeatureIcon icon={MapPin} color="cyan" />
            <h3 className="font-orbitron text-xl font-semibold mt-4 mb-2">
              Tactical Map
            </h3>
            <p className="text-muted-foreground text-sm">
              Dark-mode map with neon markers. See users and events as tactical icons on your HUD.
            </p>
          </TacticalCard>
          
          <TacticalCard glowColor="magenta" className="animate-fade-in-up delay-200 opacity-0" style={{
          animationFillMode: 'forwards'
        }}>
            <FeatureIcon icon={Radio} color="magenta" />
            <h3 className="font-orbitron text-xl font-semibold mt-4 mb-2">
              Megaphones
            </h3>
            <p className="text-muted-foreground text-sm">
              Broadcast activities to nearby users. Create public events and watch your squad assemble.
            </p>
          </TacticalCard>
          
          <TacticalCard glowColor="lime" className="animate-fade-in-up delay-300 opacity-0" style={{
          animationFillMode: 'forwards'
        }}>
            <FeatureIcon icon={Users} color="lime" />
            <h3 className="font-orbitron text-xl font-semibold mt-4 mb-2">
              Character Profiles
            </h3>
            <p className="text-muted-foreground text-sm">
              Create your avatar with skills (interests). Show the world what you're into.
            </p>
          </TacticalCard>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 container mx-auto px-4 py-16 mb-8">
        <TacticalCard className="text-center py-12 bg-gradient-to-br from-card via-card/80 to-primary/5">
          <Zap className="w-12 h-12 mx-auto text-primary mb-4" />
          <h2 className="font-orbitron text-3xl font-bold mb-4">
            Ready to <span className="text-primary text-glow-cyan">Deploy</span>?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Join the tactical network. Find real people for real activities.
          </p>
          <Link to={getAppLink()}>
            <Button variant="solidCyan" size="xl">
              {user ? "Go to Dashboard" : "Create Your Character"}
            </Button>
          </Link>
        </TacticalCard>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/50 py-6">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <span className="font-mono text-xs text-muted-foreground">
            © 2024 SQUADMAP · TACTICAL SOCIAL
          </span>
          <span className="font-mono text-xs text-primary">
            STATUS: ONLINE
          </span>
        </div>
      </footer>
    </div>;
};
export default Index;