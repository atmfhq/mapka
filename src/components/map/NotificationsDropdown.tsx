import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Bell, MapPin, UserPlus, Radio, CheckCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

const NotificationsDropdown = ({
  currentUserId,
  onFlyToSpot,
  onOpenMission,
}: NotificationsDropdownProps) => {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markAllAsRead, markAsRead, clearNotifications } = useNotifications(currentUserId);
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
          <span className="font-fredoka text-base flex items-center gap-2">
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
              {/* Pending invitations first */}
              {pendingInvitations.map((inv) => (
                <DropdownMenuItem
                  key={inv.id}
                  className="flex items-start gap-3 p-3 cursor-pointer focus:bg-warning/10"
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
                </DropdownMenuItem>
              ))}
              
              {/* Regular notifications */}
              {notifications.map((notif) => (
                <DropdownMenuItem
                  key={notif.id}
                  className={`flex items-start gap-3 p-3 cursor-pointer ${
                    !notif.read ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => handleNotificationClick(notif)}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    notif.type === 'new_spot' ? 'bg-primary/20' :
                    notif.type === 'user_joined' ? 'bg-success/20' :
                    'bg-muted'
                  }`}>
                    {getNotificationIcon(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0">
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
                </DropdownMenuItem>
              ))}
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
