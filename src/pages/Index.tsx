import { Button } from "@/components/ui/button";
import HeroRadar from "@/components/HeroRadar";
import AdventureCard from "@/components/AdventureCard";
import FeatureIcon from "@/components/FeatureIcon";
import { MapPin, Users, Radio, Gamepad2, Compass, Sparkles } from "lucide-react";
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

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background - sunny sky gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-200/50 via-background to-background pointer-events-none" />
      
      {/* Floating clouds decoration */}
      <div className="absolute top-20 left-10 w-32 h-16 bg-card/60 rounded-full blur-xl opacity-50" />
      <div className="absolute top-40 right-20 w-40 h-20 bg-card/60 rounded-full blur-xl opacity-40" />
      
      {/* Top Navigation Bar - Adventure HUD style */}
      <header className="relative z-10 border-b-3 border-border bg-card/95 backdrop-blur-sm shadow-hard">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary border-3 border-border flex items-center justify-center shadow-hard-sm">
              <Compass className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="font-fredoka text-2xl font-bold text-foreground tracking-tight">
              Squad<span className="text-primary">Map</span>
            </span>
          </div>
          
          <nav className="hidden md:flex items-center gap-6">
            <span className="text-muted-foreground font-nunito text-sm font-semibold">
              Adventure Beta v1.0
            </span>
          </nav>
          
          <div className="flex items-center gap-3">
            {user ? (
              <Link to={getAppLink()}>
                <Button variant="default" size="sm">
                  Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/auth">
                  <Button variant="ghost" size="sm" className="font-nunito">
                    Login
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button variant="default" size="sm">
                    Join Quest
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 container mx-auto px-4 py-16 md:py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-primary/50 bg-primary/10">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="font-nunito text-sm font-bold text-primary">
                Adventure Awaits!
              </span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-fredoka font-bold leading-tight">
              <span className="text-foreground">Find Your</span>
              <br />
              <span className="text-primary">Squad</span>
              <span className="text-foreground">.</span>
              <br />
              <span className="text-accent">Go Explore</span>
              <span className="text-foreground">!</span>
            </h1>
            
            <p className="text-lg text-muted-foreground max-w-lg font-nunito leading-relaxed">
              A map for finding real adventure buddies. See who's nearby, 
              discover activities, and turn online connections into real-world quests.
              <span className="text-primary font-bold"> See → Click → Go!</span>
            </p>
            
            <div className="flex flex-wrap gap-4">
              <Link to={getAppLink()}>
                <Button variant="default" size="xl" className="group">
                  <MapPin className="w-5 h-5" />
                  Start Adventure
                </Button>
              </Link>
              <Button variant="outline" size="xl" onClick={handleWatchDemo}>
                <Gamepad2 className="w-5 h-5" />
                Watch Demo
              </Button>
            </div>
            
            {/* Stats - Adventure style */}
            <div className="flex gap-8 pt-4">
              <div className="text-center">
                <div className="font-fredoka text-2xl font-bold text-primary">∞</div>
                <div className="font-nunito text-xs text-muted-foreground font-semibold uppercase">Adventures</div>
              </div>
              <div className="text-center">
                <div className="font-fredoka text-2xl font-bold text-accent">24/7</div>
                <div className="font-nunito text-xs text-muted-foreground font-semibold uppercase">Live Map</div>
              </div>
              <div className="text-center">
                <div className="font-fredoka text-2xl font-bold text-success">100%</div>
                <div className="font-nunito text-xs text-muted-foreground font-semibold uppercase">Fun</div>
              </div>
            </div>
          </div>
          
          {/* Radar visualization */}
          <div className="relative animate-fade-in-up delay-200 opacity-0" style={{
            animationFillMode: 'forwards'
          }}>
            <HeroRadar />
            
            {/* Floating labels - Adventure style */}
            <div className="absolute top-[15%] right-[10%] px-3 py-1.5 rounded-xl bg-card border-2 border-primary font-nunito text-sm font-bold text-primary shadow-hard-sm animate-bounce-soft">
              @runner_pro 🏃
            </div>
            <div className="absolute bottom-[25%] left-[5%] px-3 py-1.5 rounded-xl bg-card border-2 border-accent font-nunito text-sm font-bold text-accent shadow-hard-sm animate-bounce-soft" style={{
              animationDelay: '0.5s'
            }}>
              🎮 Gaming Night
            </div>
            <div className="absolute top-[40%] right-[5%] px-3 py-1.5 rounded-xl bg-card border-2 border-success font-nunito text-sm font-bold text-success shadow-hard-sm animate-bounce-soft" style={{
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
          <h2 className="font-fredoka text-3xl font-bold mb-4">
            <span className="text-muted-foreground">Quest</span>{" "}
            <span className="text-primary">Features</span>
          </h2>
          <p className="text-muted-foreground font-nunito max-w-xl mx-auto">
            Everything you need to coordinate with your squad
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-6">
          <AdventureCard color="forest" className="animate-fade-in-up delay-100 opacity-0" style={{
            animationFillMode: 'forwards'
          }}>
            <FeatureIcon icon={MapPin} color="forest" />
            <h3 className="font-fredoka text-xl font-bold mt-4 mb-2">
              Adventure Map
            </h3>
            <p className="text-muted-foreground text-sm font-nunito">
              Explore the map and see other adventurers nearby. Find your next quest!
            </p>
          </AdventureCard>
          
          <AdventureCard color="gold" className="animate-fade-in-up delay-200 opacity-0" style={{
            animationFillMode: 'forwards'
          }}>
            <FeatureIcon icon={Radio} color="gold" />
            <h3 className="font-fredoka text-xl font-bold mt-4 mb-2">
              Megaphones
            </h3>
            <p className="text-muted-foreground text-sm font-nunito">
              Broadcast activities to nearby users. Create public events and gather your party!
            </p>
          </AdventureCard>
          
          <AdventureCard color="berry" className="animate-fade-in-up delay-300 opacity-0" style={{
            animationFillMode: 'forwards'
          }}>
            <FeatureIcon icon={Users} color="berry" />
            <h3 className="font-fredoka text-xl font-bold mt-4 mb-2">
              Character Profiles
            </h3>
            <p className="text-muted-foreground text-sm font-nunito">
              Create your avatar with skills (interests). Show the world what you're into!
            </p>
          </AdventureCard>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 container mx-auto px-4 py-16 mb-8">
        <AdventureCard color="forest" className="text-center py-12 bg-gradient-to-br from-card via-card/80 to-primary/10">
          <Sparkles className="w-12 h-12 mx-auto text-primary mb-4" />
          <h2 className="font-fredoka text-3xl font-bold mb-4">
            Ready to <span className="text-primary">Explore</span>?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto font-nunito">
            Join the adventure. Find real people for real activities!
          </p>
          <Link to={getAppLink()}>
            <Button variant="default" size="xl">
              {user ? "Go to Dashboard" : "Create Your Character"}
            </Button>
          </Link>
        </AdventureCard>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t-3 border-border bg-card py-6">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <span className="font-nunito text-sm text-muted-foreground font-semibold">
            © 2024 SquadMap · Adventure Together
          </span>
          <span className="font-nunito text-sm text-primary font-bold">
            🟢 ONLINE
          </span>
        </div>
      </footer>
    </div>
  );
};

export default Index;