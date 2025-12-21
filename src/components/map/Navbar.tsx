import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Target, LogOut, Settings, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import AlertsDrawer from './AlertsDrawer';
import ChatDrawer from './ChatDrawer';
import InstallPrompt from '@/components/InstallPrompt';

interface NavbarProps {
  nick: string;
  avatarUrl: string | null;
  currentUserId: string;
  onSignOut: () => void;
  onMissionCreated?: () => void;
  onOpenMission?: (missionId: string) => void;
  onOpenChatWithUser?: (userId: string) => void;
}

const Navbar = ({ 
  nick, 
  avatarUrl, 
  currentUserId,
  onSignOut,
  onMissionCreated,
  onOpenMission,
  onOpenChatWithUser,
}: NavbarProps) => {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <header className="absolute top-0 left-0 right-0 z-30 pointer-events-none safe-area-top">
      <div className="bg-background/90 backdrop-blur-md border-b border-border/50 pointer-events-auto">
        <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-3">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            {/* Logo */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <div className="w-10 h-10 sm:w-9 sm:h-9 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
                <Target className="w-5 h-5 text-primary" />
              </div>
              <span className="font-orbitron text-base sm:text-lg font-bold tracking-wider hidden sm:block">
                SQUAD<span className="text-primary">MAP</span>
              </span>
            </div>

            {/* User Controls */}
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              {/* Alerts (Public Events) */}
              <AlertsDrawer 
                currentUserId={currentUserId}
                onOpenMission={onOpenMission}
              />

              {/* Chats (Active Connections) */}
              <ChatDrawer 
                currentUserId={currentUserId}
              />

              {/* Settings Menu */}
              <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
                <SheetTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="min-w-[44px] min-h-[44px] text-muted-foreground hover:text-foreground"
                  >
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={nick}
                        className="w-8 h-8 rounded-lg border border-primary/30 object-cover"
                      />
                    ) : (
                      <Settings className="w-5 h-5" />
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh]">
                  <SheetHeader className="pb-4 border-b border-border/50">
                    <SheetTitle className="font-orbitron text-xl flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center overflow-hidden">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt={nick} className="w-full h-full object-cover" />
                        ) : (
                          <Target className="w-6 h-6 text-primary" />
                        )}
                      </div>
                      <div className="text-left">
                        <div>{nick}</div>
                        <div className="text-sm font-rajdhani font-normal text-muted-foreground">
                          Operative Profile
                        </div>
                      </div>
                    </SheetTitle>
                  </SheetHeader>
                  
                  <div className="py-4 space-y-3">
                    <Link to="/profile/edit" onClick={() => setSettingsOpen(false)}>
                      <Button
                        variant="outline"
                        className="w-full justify-start gap-3 border-primary/30 text-primary hover:bg-primary/10 min-h-[48px]"
                      >
                        <UserCog className="w-5 h-5" />
                        <span className="font-medium">Edit Profile</span>
                      </Button>
                    </Link>
                    
                    <InstallPrompt />
                    
                    <Button
                      onClick={() => {
                        setSettingsOpen(false);
                        onSignOut();
                      }}
                      variant="outline"
                      className="w-full justify-start gap-3 border-destructive/30 text-destructive hover:bg-destructive/10 min-h-[48px]"
                    >
                      <LogOut className="w-5 h-5" />
                      <span className="font-medium">Sign Out</span>
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
