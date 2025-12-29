import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Target, ArrowLeft, Mail, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useKeyboardAvoidance } from "@/hooks/useKeyboardAvoidance";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile, loading: authLoading } = useAuth();
  const keyboardRef = useKeyboardAvoidance();

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

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({
        title: "Email Required",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;

      setMagicLinkSent(true);
      toast({
        title: "Magic Link Sent!",
        description: "Check your email for a login link",
      });
    } catch (error: any) {
      toast({
        title: "Failed to Send",
        description: error.message || "Could not send magic link",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;
    } catch (error: any) {
      toast({
        title: "Google Login Failed",
        description: error.message || "Could not sign in with Google",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const handleResendLink = () => {
    setMagicLinkSent(false);
    setEmail("");
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
                {magicLinkSent ? "Check Your Email" : "Login or Sign Up"}
              </p>
            </div>
          </div>

          {magicLinkSent ? (
            /* Magic Link Sent State */
            <div className="text-center space-y-6">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-success/20 border-2 border-success/40 flex items-center justify-center">
                <Mail className="w-10 h-10 text-success" />
              </div>
              
              <div>
                <h2 className="font-fredoka text-lg font-bold mb-2">
                  Magic Link Sent!
                </h2>
                <p className="font-nunito text-sm text-muted-foreground">
                  We sent a login link to{" "}
                  <span className="font-bold text-foreground">{email}</span>
                </p>
              </div>

              <div className="space-y-3 pt-4">
                <p className="font-nunito text-xs text-muted-foreground">
                  Click the link in your email to log in. The link expires in 1 hour.
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleResendLink}
                >
                  Use Different Email
                </Button>
              </div>
            </div>
          ) : (
            /* Login Form */
            <>
              {/* Google Login */}
              <Button
                type="button"
                variant="outline"
                className="w-full mb-6 h-12 gap-3 font-nunito font-bold"
                onClick={handleGoogleLogin}
                disabled={loading}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </Button>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground font-nunito">
                    or use email
                  </span>
                </div>
              </div>

              {/* Magic Link Form */}
              <form onSubmit={handleMagicLink} className="space-y-4">
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

                <Button
                  type="submit"
                  variant="default"
                  className="w-full"
                  size="lg"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      Send Magic Link
                    </>
                  )}
                </Button>
              </form>

              {/* Footer */}
              <p className="text-center text-muted-foreground text-xs mt-6 font-nunito">
                No password needed! We'll send you a secure login link.
              </p>
            </>
          )}
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
