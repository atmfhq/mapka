import { useState } from 'react';
import ChatDrawer from './ChatDrawer';
import ConnectionsDrawer from './ConnectionsDrawer';
import NotificationsDropdown from './NotificationsDropdown';
import EditProfileModal from './EditProfileModal';
import AvatarDisplay from '@/components/avatar/AvatarDisplay';

interface AvatarConfig {
  skinColor?: string;
  shape?: string;
  eyes?: string;
  mouth?: string;
}

interface ViewportBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface BottomNavProps {
  currentUserId: string;
  avatarConfig?: AvatarConfig | null;
  onSignOut: () => void;
  onOpenMission?: (missionId: string) => void;
  chatOpenUserId?: string | null;
  onChatOpenChange?: (open: boolean) => void;
  onFlyTo: (lat: number, lng: number) => void;
  viewportBounds?: ViewportBounds | null;
}

const BottomNav = ({
  currentUserId,
  avatarConfig,
  onSignOut,
  onOpenMission,
  chatOpenUserId,
  onChatOpenChange,
  onFlyTo,
  viewportBounds,
}: BottomNavProps) => {
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden pb-safe">
        <div className="bg-card border-t-2 border-border">
          <div className="flex items-center justify-around h-16 px-2">
            {/* Chats */}
            <div className="flex items-center justify-center min-w-[44px] min-h-[44px]">
              <ChatDrawer 
                key={`bottom-chat-${currentUserId}`}
                currentUserId={currentUserId}
                externalOpen={!!chatOpenUserId}
                externalUserId={chatOpenUserId}
                onOpenChange={onChatOpenChange}
              />
            </div>

            {/* Connections */}
            <div className="flex items-center justify-center min-w-[44px] min-h-[44px]">
              <ConnectionsDrawer 
                currentUserId={currentUserId}
                viewportBounds={viewportBounds ?? null}
                onFlyTo={onFlyTo}
              />
            </div>

            {/* Notifications */}
            <div className="flex items-center justify-center min-w-[44px] min-h-[44px]">
              <NotificationsDropdown 
                currentUserId={currentUserId}
                onFlyToSpot={onFlyTo}
                onOpenMission={onOpenMission}
              />
            </div>

            {/* Profile Avatar */}
            <button 
              onClick={() => setProfileModalOpen(true)}
              className="flex items-center justify-center min-w-[44px] min-h-[44px] hover:scale-105 transition-transform"
            >
              <AvatarDisplay config={avatarConfig} size={40} showGlow={false} />
            </button>
          </div>
        </div>
      </nav>

      <EditProfileModal 
        open={profileModalOpen} 
        onOpenChange={setProfileModalOpen}
        onSignOut={onSignOut}
      />
    </>
  );
};

export default BottomNav;
