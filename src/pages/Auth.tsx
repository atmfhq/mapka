import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Target, ArrowLeft, Mail, Lock, User } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useKeyboardAvoidance } from "@/hooks/useKeyboardAvoidance";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile, loading: authLoading } = useAuth();
  const keyboardRef = useKeyboardAvoidance();

  // Read initial mode from URL query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    if (mode === 'signup') {
      setIsLogin(false);
    } else if (mode === 'login') {
      setIsLogin(true);
    }
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      if (profile?.is_onboarded) {
        navigate("/");
      } else {
        navigate("/onboarding");
      }
    }
  }, [user, profile, authLoading, navigate]);

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
          title: "Welcome back!",
          description: "Successfully logged in to Mapka",
        });
        // Navigation handled by useEffect
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
    <div ref={keyboardRef} className="min-h-dvh bg-background overflow-y-auto">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 pointer-events-none" />
      
      <div className="relative z-10 w-full max-w-md mx-auto p-4 py-8 pb-safe flex flex-col min-h-dvh justify-center">
        {/* Back link */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-8 font-nunito text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Map
        </Link>

        {/* Auth card */}
        <div className="relative bg-card border-3 border-border rounded-2xl p-8 shadow-hard">

          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-primary/20 border-2 border-primary/40 flex items-center justify-center shadow-hard-sm">
              <Target className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="font-fredoka text-xl font-bold">
                Map<span className="text-primary">ka</span>
              </h1>
              <p className="font-nunito text-xs text-muted-foreground">
                {isLogin ? "Welcome Back!" : "Create Your Character"}
              </p>
            </div>
          </div>

          {/* Toggle */}
          <div className="flex mb-6 bg-muted rounded-xl p-1 border-2 border-border">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 px-4 rounded-lg font-nunito font-bold text-sm transition-all ${
                isLogin
                  ? "bg-primary text-primary-foreground shadow-hard-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 px-4 rounded-lg font-nunito font-bold text-sm transition-all ${
                !isLogin
                  ? "bg-primary text-primary-foreground shadow-hard-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="font-nunito text-sm font-medium text-foreground">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="adventurer@mapka.app"
                  className="pl-10 bg-muted/50 border-2 border-border focus:border-primary rounded-xl"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="font-nunito text-sm font-medium text-foreground">
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
                  className="pl-10 bg-muted/50 border-2 border-border focus:border-primary rounded-xl"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="default"
              className="w-full"
              size="lg"
              disabled={loading}
            >
              {loading ? (
                <span className="animate-pulse">Processing...</span>
              ) : isLogin ? (
                <>
                  <User className="w-4 h-4" />
                  Login
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
          <p className="text-center text-muted-foreground text-sm mt-6 font-nunito">
            {isLogin ? (
              <>
                New adventurer?{" "}
                <button
                  onClick={() => setIsLogin(false)}
                  className="text-primary hover:underline font-bold"
                >
                  Create character
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  onClick={() => setIsLogin(true)}
                  className="text-primary hover:underline font-bold"
                >
                  Login
                </button>
              </>
            )}
          </p>
        </div>

        {/* Status indicator */}
        <div className="text-center mt-6 mb-8">
          <span className="inline-flex items-center gap-2 font-nunito text-xs text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            Ready to Adventure
          </span>
        </div>
      </div>
    </div>
  );
};

export default Auth;
