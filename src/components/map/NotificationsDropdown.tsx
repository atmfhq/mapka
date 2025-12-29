import { useState, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Bell, MapPin, UserPlus, Radio, CheckCheck, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications } from '@/hooks/useNotifications';
import { useInvitationRealtime } from '@/hooks/useInvitationRealtime';

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
    // Only allow swiping left (negative values)
    if (diff < 0) {
      setOffsetX(diff);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (offsetX < -SWIPE_THRESHOLD) {
      // Animate out and dismiss
      setIsRemoving(true);
      setTimeout(() => {
        onDismiss();
      }, 200);
    } else {
      // Snap back
      setOffsetX(0);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    // Only trigger click if not swiping
    if (Math.abs(offsetX) < 10) {
      onClick();
    }
  };

  return (
    <div 
      className={`relative overflow-hidden transition-all duration-200 ${isRemoving ? 'h-0 opacity-0' : ''}`}
    >
      {/* Delete background */}
      <div className="absolute inset-0 bg-destructive flex items-center justify-end px-4">
        <Trash2 className="w-5 h-5 text-destructive-foreground" />
      </div>
      
      {/* Swipeable content */}
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
  const { notifications, unreadCount, markAllAsRead, markAsRead, clearNotifications, dismissNotification } = useNotifications(currentUserId);
  const { pendingInvitations, pendingCount } = useInvitationRealtime(currentUserId);

  // Total badge count = notifications + pending invitations
  const totalBadgeCount = unreadCount + pendingCount;

  const handleNotificationClick = (notif: typeof notifications[0]) => {
    markAsRead(notif.id);
    
    if (notif.metadata?.lat && notif.metadata?.lng) {
      onFlyToSpot?.(notif.metadata.lat, notif.metadata.lng);
    }
    
    if (notif.metadata?.spotId) {
      onOpenMission?.(notif.metadata.spotId);
    }
    
    setOpen(false);
  };

  const handleMarkAllRead = () => {
    markAllAsRead();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'new_spot':
        return <MapPin className="w-4 h-4 text-primary" />;
      case 'invitation_received':
        return <Radio className="w-4 h-4 text-warning" />;
      case 'invitation_accepted':
        return <Radio className="w-4 h-4 text-success" />;
      case 'user_joined':
        return <UserPlus className="w-4 h-4 text-success" />;
      default:
        return <Bell className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative min-w-[44px] min-h-[44px] text-muted-foreground hover:text-foreground"
        >
          <Bell className="w-5 h-5" />
          {totalBadgeCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center animate-pulse">
              {totalBadgeCount > 99 ? '99+' : totalBadgeCount}
            </span>
          )}
        </Button>
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
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.preventDefault();
                handleMarkAllRead();
              }}
            >
              <CheckCheck className="w-3 h-3 mr-1" />
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <ScrollArea className="h-[300px]">
          {notifications.length === 0 && pendingCount === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Bell className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                We'll notify you about nearby spots and activity
              </p>
            </div>
          ) : (
            <div className="py-1">
              {/* Pending invitations first (non-swipeable) */}
              {pendingInvitations.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-start gap-3 p-3 cursor-pointer hover:bg-warning/10"
                >
                  <div className="w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center flex-shrink-0">
                    <Radio className="w-4 h-4 text-warning" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">New Invitation</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {inv.sender?.nick || 'Someone'} wants to connect
                    </p>
                    <p className="text-[10px] text-warning mt-1">
                      {formatDistanceToNow(new Date(inv.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-warning flex-shrink-0 mt-1" />
                </div>
              ))}
              
              {/* Swipeable notifications */}
              {notifications.map((notif) => (
                <SwipeableNotification
                  key={notif.id}
                  id={notif.id}
                  onDismiss={() => dismissNotification(notif.id)}
                  onClick={() => handleNotificationClick(notif)}
                >
                  <div
                    className={`group relative flex items-start gap-3 p-3 cursor-pointer ${
                      !notif.read ? 'bg-primary/5' : ''
                    } hover:bg-muted/50`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      notif.type === 'new_spot' ? 'bg-primary/20' :
                      notif.type === 'user_joined' ? 'bg-success/20' :
                      'bg-muted'
                    }`}>
                      {getNotificationIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0 pr-6">
                      <p className="text-sm font-medium truncate">{notif.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {notif.description}
                      </p>
                      <p className="text-[10px] text-muted-foreground/70 mt-1">
                        {formatDistanceToNow(new Date(notif.timestamp), { addSuffix: true })}
                      </p>
                    </div>
                    {!notif.read && (
                      <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                    )}
                    {/* Desktop dismiss button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        dismissNotification(notif.id);
                      }}
                      className="absolute top-2 right-2 p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-destructive/20 transition-opacity hidden md:flex items-center justify-center"
                      aria-label="Dismiss notification"
                    >
                      <X className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                </SwipeableNotification>
              ))}
              
              {/* Swipe hint for mobile */}
              {notifications.length > 0 && (
                <p className="text-[10px] text-muted-foreground/50 text-center py-2 md:hidden">
                  Swipe left to dismiss
                </p>
              )}
            </div>
          )}
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
                  clearNotifications();
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
