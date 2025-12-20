import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import TacticalCard from "@/components/TacticalCard";
import { Target, MapPin, Radio, Users, LogOut, User } from "lucide-react";

const Dashboard = () => {
  const { user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
    if (!loading && profile && !profile.is_onboarded) {
      navigate("/onboarding");
    }
  }, [loading, user, profile, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (loading || !profile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background tactical-grid">
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

          <div className="flex items-center gap-4">
            {/* User info */}
            <div className="flex items-center gap-3">
              {profile.avatar_url && (
                <img
                  src={profile.avatar_url}
                  alt={profile.nick || "Avatar"}
                  className="w-10 h-10 rounded-lg border border-primary/30"
                />
              )}
              <div className="hidden md:block">
                <div className="font-rajdhani font-semibold text-foreground">
                  {profile.nick}
                </div>
                <div className="font-mono text-xs text-muted-foreground">
                  Operative Active
                </div>
              </div>
            </div>

            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="font-orbitron text-3xl font-bold mb-2">
            Welcome, <span className="text-primary">{profile.nick}</span>
          </h1>
          <p className="text-muted-foreground font-rajdhani">
            Your tactical headquarters is ready.
          </p>
        </div>

        {/* Quick stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <TacticalCard glowColor="cyan">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-primary" />
              </div>
              <div>
                <div className="font-mono text-xs text-muted-foreground uppercase">Base Location</div>
                <div className="font-rajdhani font-semibold text-foreground">
                  {profile.base_lat && profile.base_lng ? "Established" : "Not Set"}
                </div>
              </div>
            </div>
          </TacticalCard>

          <TacticalCard glowColor="magenta">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center">
                <Radio className="w-6 h-6 text-accent" />
              </div>
              <div>
                <div className="font-mono text-xs text-muted-foreground uppercase">Active Megaphones</div>
                <div className="font-rajdhani font-semibold text-foreground">0</div>
              </div>
            </div>
          </TacticalCard>

          <TacticalCard glowColor="lime">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-success/20 border border-success/30 flex items-center justify-center">
                <Users className="w-6 h-6 text-success" />
              </div>
              <div>
                <div className="font-mono text-xs text-muted-foreground uppercase">Nearby Operatives</div>
                <div className="font-rajdhani font-semibold text-foreground">--</div>
              </div>
            </div>
          </TacticalCard>
        </div>

        {/* Profile card */}
        <TacticalCard className="max-w-md">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-primary" />
            <h2 className="font-orbitron text-lg font-semibold">Operative Profile</h2>
          </div>
          
          <div className="flex items-start gap-4">
            {profile.avatar_url && (
              <img
                src={profile.avatar_url}
                alt={profile.nick || "Avatar"}
                className="w-20 h-20 rounded-lg border-2 border-primary/30"
              />
            )}
            <div className="flex-1">
              <div className="font-orbitron text-xl font-bold text-primary mb-1">
                {profile.nick}
              </div>
              {profile.bio && (
                <p className="text-muted-foreground text-sm mb-3">{profile.bio}</p>
              )}
              {profile.tags && profile.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {profile.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 rounded bg-primary/20 border border-primary/30 font-mono text-xs text-primary"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TacticalCard>

        {/* Coming soon placeholder */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-muted/30">
            <Radio className="w-4 h-4 text-primary animate-pulse" />
            <span className="font-mono text-sm text-muted-foreground">
              Tactical Map Coming Soon
            </span>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
