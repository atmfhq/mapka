import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Target, LogOut, UserCog, MapPin, Ghost, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import AlertsDrawer from './AlertsDrawer';
import ChatDrawer from './ChatDrawer';
import InstallPrompt from '@/components/InstallPrompt';
import AvatarDisplay from '@/components/avatar/AvatarDisplay';

interface AvatarConfig {
  skinColor?: string;
  shape?: string;
  eyes?: string;
  mouth?: string;
}

interface NavbarProps {
  nick: string;
  avatarUrl: string | null;
  avatarConfig?: AvatarConfig | null;
  currentUserId: string;
  isActive: boolean;
  onActiveChange: (active: boolean) => void;
  onSignOut: () => void;
  onMissionCreated?: () => void;
  onOpenMission?: (missionId: string) => void;
  onFlyToQuest?: (lat: number, lng: number) => void;
  chatOpenUserId?: string | null;
  onChatOpenChange?: (open: boolean) => void;
  onRelocateClick?: () => void;
}

const Navbar = ({ 
  nick, 
  avatarUrl,
  avatarConfig,
  currentUserId,
  isActive,
  onActiveChange,
  onSignOut,
  onMissionCreated,
  onOpenMission,
  onFlyToQuest,
  chatOpenUserId,
  onChatOpenChange,
  onRelocateClick,
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
                onFlyToQuest={onFlyToQuest}
              />

              {/* Chats (Active Connections) */}
              <ChatDrawer 
                key={`chat-drawer-${currentUserId}`}
                currentUserId={currentUserId}
                externalOpen={!!chatOpenUserId}
                externalUserId={chatOpenUserId}
                onOpenChange={onChatOpenChange}
                onOpenMission={onOpenMission}
              />

              {/* Relocate Base */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onRelocateClick}
                    className="min-w-[44px] min-h-[44px] text-muted-foreground hover:text-foreground"
                  >
                    <MapPin className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Relocate Base</p>
                </TooltipContent>
              </Tooltip>

              {/* Profile Avatar Button */}
              <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
                <SheetTrigger asChild>
                <button 
                    onClick={() => setSettingsOpen(true)}
                    className="w-10 h-10 rounded-full overflow-hidden hover:opacity-80 transition-opacity"
                  >
                    <AvatarDisplay config={avatarConfig} size={40} showGlow={false} />
                  </button>
                </SheetTrigger>
                <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh]">
                  <SheetHeader className="pb-4 border-b border-border/50">
                    <SheetTitle className="font-orbitron text-xl flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary/40">
                        <AvatarDisplay config={avatarConfig} size={48} showGlow={false} />
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

                    {/* Ghost Mode Toggle */}
                    <div className={`flex items-center justify-between p-4 rounded-lg border ${
                      isActive 
                        ? 'border-border/50 bg-card/50' 
                        : 'border-muted-foreground/30 bg-muted/20'
                    }`}>
                      <div className="flex items-center gap-3">
                        {isActive ? (
                          <Eye className="w-5 h-5 text-primary" />
                        ) : (
                          <Ghost className="w-5 h-5 text-muted-foreground" />
                        )}
                        <div>
                          <Label htmlFor="ghost-mode" className="font-medium cursor-pointer">
                            {isActive ? 'Visible' : 'Ghost Mode'}
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            {isActive ? 'Others can see you on the map' : 'You are hidden from others'}
                          </p>
                        </div>
                      </div>
                      <Switch
                        id="ghost-mode"
                        checked={isActive}
                        onCheckedChange={onActiveChange}
                      />
                    </div>
                    
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
