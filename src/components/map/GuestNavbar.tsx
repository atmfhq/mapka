import { Link } from 'react-router-dom';
import { Target, LogIn, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';

const GuestNavbar = () => {
  return (
    <header className="absolute top-0 left-0 right-0 z-30 pointer-events-none safe-area-top">
      <div className="bg-background/90 backdrop-blur-md border-b border-border/50 pointer-events-auto">
        <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-3">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            {/* Logo */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <div className="w-10 h-10 sm:w-9 sm:h-9 rounded-xl bg-primary/20 border-2 border-primary/40 flex items-center justify-center shadow-hard-sm">
                <Target className="w-5 h-5 text-primary" />
              </div>
              <span className="font-fredoka text-base sm:text-lg font-bold tracking-tight hidden sm:block">
                SQUAD<span className="text-primary">MAP</span>
              </span>
            </div>

            {/* Guest Controls */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link to="/auth">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 font-nunito min-h-[40px]"
                >
                  <LogIn className="w-4 h-4" />
                  <span className="hidden sm:inline">Sign In</span>
                </Button>
              </Link>
              <Link to="/auth">
                <Button
                  size="sm"
                  className="gap-2 font-nunito min-h-[40px]"
                >
                  <UserPlus className="w-4 h-4" />
                  <span className="hidden sm:inline">Join</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default GuestNavbar;
