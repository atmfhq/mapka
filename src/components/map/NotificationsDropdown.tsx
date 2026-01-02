import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { formatDistanceToNow } from 'date-fns';
import { Bell, MapPin, UserPlus, MessageCircle, Megaphone, CheckCheck, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDbNotifications } from '@/hooks/useDbNotifications';
import { useIsMobile } from '@/hooks/use-mobile';

interface NotificationsDropdownProps {
  currentUserId: string;
  onFlyToSpot?: (lat: number, lng: number) => void;
  onOpenMission?: (missionId: string) => void;
}

interface SwipeableNotificationProps {
  id: string;
  children: React.ReactNode;
  onDismiss: () => void;
  onClick: () => void;
}

const SWIPE_THRESHOLD = 80;

const SwipeableNotification = ({ id, children, onDismiss, onClick }: SwipeableNotificationProps) => {
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = e.touches[0].clientX;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    currentXRef.current = e.touches[0].clientX;
    const diff = currentXRef.current - startXRef.current;
    if (diff < 0) {
      setOffsetX(diff);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (offsetX < -SWIPE_THRESHOLD) {
      setIsRemoving(true);
      setTimeout(() => {
        onDismiss();
      }, 200);
    } else {
      setOffsetX(0);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (Math.abs(offsetX) < 10) {
      onClick();
    }
  };

  return (
    <div 
      className={`relative overflow-hidden transition-all duration-200 ${isRemoving ? 'h-0 opacity-0' : ''}`}
    >
      <div className="absolute inset-0 bg-destructive flex items-center justify-end px-4">
        <Trash2 className="w-5 h-5 text-destructive-foreground" />
      </div>
      
      <div
        className={`relative bg-card ${isDragging ? '' : 'transition-transform duration-200'}`}
        style={{ transform: `translateX(${offsetX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
      >
        {children}
      </div>
    </div>
  );
};

const NotificationsDropdown = ({
  currentUserId,
  onFlyToSpot,
  onOpenMission,
}: NotificationsDropdownProps) => {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const { 
    notifications, 
    hasUnread, 
    markAsRead, 
    markAllAsRead, 
    clearAll, 
    getResourceInfo 
  } = useDbNotifications(currentUserId);

  const handleNotificationClick = async (notif: typeof notifications[0]) => {
    // Mark as read in DB
    await markAsRead(notif.id);
    
    // Get resource info for flying to location
    const resource = getResourceInfo(notif.resource_id);
    
    if (resource?.lat && resource?.lng) {
      onFlyToSpot?.(resource.lat, resource.lng);
    }
    
    // Open the mission/shout based on type
    if (notif.type === 'friend_event' || notif.type === 'new_participant') {
      onOpenMission?.(notif.resource_id);
    } else if (notif.type === 'new_comment') {
      // Comments can be on events or shouts - check resource type
      onOpenMission?.(notif.resource_id);
    } else if (notif.type === 'friend_shout') {
      // For shouts, just fly to location (shout details via marker click)
      // The fly action is already handled above
    }
    
    setOpen(false);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'friend_event':
        return <MapPin className="w-4 h-4 text-primary" />;
      case 'friend_shout':
        return <Megaphone className="w-4 h-4 text-warning" />;
      case 'new_participant':
        return <UserPlus className="w-4 h-4 text-success" />;
      case 'new_comment':
        return <MessageCircle className="w-4 h-4 text-info" />;
      default:
        return <Bell className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getNotificationTitle = (notif: typeof notifications[0]) => {
    const userName = notif.trigger_user?.nick || 'Someone';
    switch (notif.type) {
      case 'friend_event':
        return `${userName} created an event`;
      case 'friend_shout':
        return `${userName} shouted`;
      case 'new_participant':
        return `${userName} joined your event`;
      case 'new_comment':
        return `${userName} commented`;
      default:
        return 'New notification';
    }
  };

  const getNotificationDescription = (notif: typeof notifications[0]) => {
    const resource = getResourceInfo(notif.resource_id);
    if (resource?.title) {
      return `"${resource.title}"`;
    }
    if (resource?.content) {
      return `"${resource.content}"`;
    }
    return '';
  };

  const triggerButton = (
    <Button
      variant="ghost"
      size="icon"
      className="relative min-w-[44px] min-h-[44px] text-muted-foreground hover:text-foreground"
      onClick={() => isMobile && setOpen(true)}
    >
      <Bell className="w-5 h-5" />
      {hasUnread && (
        <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-destructive" />
      )}
    </Button>
  );

  const notificationsContent = (
    <>
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Bell className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No notifications yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            You'll be notified when friends create events or join yours
          </p>
        </div>
      ) : (
        <div className="py-1">
          {notifications.map((notif) => (
            <SwipeableNotification
              key={notif.id}
              id={notif.id}
              onDismiss={async () => {
                // Delete notification on swipe
                await markAsRead(notif.id);
              }}
              onClick={() => handleNotificationClick(notif)}
            >
              <div
                className={`group relative flex items-start gap-3 p-3 cursor-pointer ${
                  !notif.is_read ? 'bg-primary/5' : ''
                } hover:bg-muted/50`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  notif.type === 'friend_event' ? 'bg-primary/20' :
                  notif.type === 'friend_shout' ? 'bg-warning/20' :
                  notif.type === 'new_participant' ? 'bg-success/20' :
                  notif.type === 'new_comment' ? 'bg-info/20' :
                  'bg-muted'
                }`}>
                  {getNotificationIcon(notif.type)}
                </div>
                <div className="flex-1 min-w-0 pr-6">
                  <p className="text-sm font-medium truncate">{getNotificationTitle(notif)}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {getNotificationDescription(notif)}
                  </p>
                  <p className="text-[10px] text-muted-foreground/70 mt-1">
                    {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                  </p>
                </div>
                {!notif.is_read && (
                  <div className="w-2 h-2 rounded-full bg-destructive flex-shrink-0 mt-1" />
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    markAsRead(notif.id);
                  }}
                  className="absolute top-2 right-2 p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity hidden md:flex items-center justify-center"
                  aria-label="Mark as read"
                >
                  <X className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>
            </SwipeableNotification>
          ))}
          
          {notifications.length > 0 && (
            <p className="text-[10px] text-muted-foreground/50 text-center py-2 md:hidden">
              Swipe left to dismiss
            </p>
          )}
        </div>
      )}
    </>
  );

  // Mobile: Full-screen modal
  if (isMobile) {
    if (!open) {
      return triggerButton;
    }

    const mobileModalContent = (
      <div className="fixed inset-0 z-[9999] flex flex-col" style={{ isolation: 'isolate' }}>
        <div className="bg-card w-screen h-dvh flex flex-col animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-warning" />
              <div>
                <h3 className="font-nunito font-bold text-foreground">Notifications</h3>
                <p className="text-xs text-muted-foreground">
                  {hasUnread ? 'New notifications' : 'All caught up'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasUnread && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                  onClick={markAllAsRead}
                >
                  <CheckCheck className="w-3 h-3 mr-1" />
                  Mark all read
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                className="rounded-lg hover:bg-muted"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1 overflow-auto">
            <div className="p-4">
              {notificationsContent}
            </div>
          </ScrollArea>

          {notifications.length > 0 && (
            <div className="p-4 border-t border-border shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground hover:text-destructive"
                onClick={clearAll}
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Clear all
              </Button>
            </div>
          )}
        </div>
      </div>
    );

    return (
      <>
        {triggerButton}
        {createPortal(mobileModalContent, document.body)}
      </>
    );
  }

  // Desktop: Dropdown menu
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        {triggerButton}
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-80 bg-card border-border shadow-hard z-[100]"
        sideOffset={8}
      >
        <DropdownMenuLabel className="flex items-center justify-between">
          <span className="font-nunito text-base font-semibold flex items-center gap-2">
            <Bell className="w-4 h-4 text-warning" />
            Notifications
          </span>
          {hasUnread && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.preventDefault();
                markAllAsRead();
              }}
            >
              <CheckCheck className="w-3 h-3 mr-1" />
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <ScrollArea className="h-[300px]">
          {notificationsContent}
        </ScrollArea>

        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.preventDefault();
                  clearAll();
                }}
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Clear all
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationsDropdown;
