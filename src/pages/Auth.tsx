import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Target, ArrowLeft, Mail, Lock, User } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast({
          title: "Welcome back, Operator",
          description: "Successfully logged in to SquadMap",
        });
        navigate("/");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (error) throw error;
        toast({
          title: "Character Created",
          description: "Check your email to confirm your account",
        });
      }
    } catch (error: any) {
      toast({
        title: "Mission Failed",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background tactical-grid flex items-center justify-center p-4">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
      
      <div className="relative z-10 w-full max-w-md">
        {/* Back link */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-8 font-mono text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Base
        </Link>

        {/* Auth card */}
        <div className="relative bg-card/50 backdrop-blur-sm border border-border rounded-lg p-8">
          {/* Corner accents */}
          <div className="absolute top-0 left-0 w-6 h-6 border-l-2 border-t-2 border-primary/50 rounded-tl" />
          <div className="absolute top-0 right-0 w-6 h-6 border-r-2 border-t-2 border-primary/50 rounded-tr" />
          <div className="absolute bottom-0 left-0 w-6 h-6 border-l-2 border-b-2 border-primary/50 rounded-bl" />
          <div className="absolute bottom-0 right-0 w-6 h-6 border-r-2 border-b-2 border-primary/50 rounded-br" />

          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Target className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="font-orbitron text-xl font-bold">
                SQUAD<span className="text-primary">MAP</span>
              </h1>
              <p className="font-mono text-xs text-muted-foreground uppercase">
                {isLogin ? "Operator Login" : "Create Character"}
              </p>
            </div>
          </div>

          {/* Toggle */}
          <div className="flex mb-6 bg-muted rounded-lg p-1">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 px-4 rounded-md font-rajdhani font-semibold text-sm transition-all ${
                isLogin
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 px-4 rounded-md font-rajdhani font-semibold text-sm transition-all ${
                !isLogin
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="font-mono text-xs uppercase text-muted-foreground">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@squad.map"
                  className="pl-10 bg-muted/50 border-border focus:border-primary"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="font-mono text-xs uppercase text-muted-foreground">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 bg-muted/50 border-border focus:border-primary"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="solidCyan"
              className="w-full"
              size="lg"
              disabled={loading}
            >
              {loading ? (
                <span className="animate-pulse">Processing...</span>
              ) : isLogin ? (
                <>
                  <User className="w-4 h-4" />
                  Access Terminal
                </>
              ) : (
                <>
                  <Target className="w-4 h-4" />
                  Create Character
                </>
              )}
            </Button>
          </form>

          {/* Footer */}
          <p className="text-center text-muted-foreground text-xs mt-6 font-mono">
            {isLogin ? (
              <>
                New operator?{" "}
                <button
                  onClick={() => setIsLogin(false)}
                  className="text-primary hover:underline"
                >
                  Create character
                </button>
              </>
            ) : (
              <>
                Already deployed?{" "}
                <button
                  onClick={() => setIsLogin(true)}
                  className="text-primary hover:underline"
                >
                  Login
                </button>
              </>
            )}
          </p>
        </div>

        {/* Status indicator */}
        <div className="text-center mt-6">
          <span className="inline-flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            Secure Connection Active
          </span>
        </div>
      </div>
    </div>
  );
};

export default Auth;
