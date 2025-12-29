import { formatDistanceToNow } from 'date-fns';
import { Megaphone, Radio } from 'lucide-react';
import AvatarDisplay from '@/components/avatar/AvatarDisplay';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ConversationItem } from '@/hooks/useUnifiedConversations';

interface ConversationRowProps {
  item: ConversationItem;
  onSelect: (item: ConversationItem) => void;
  onAcceptInvite?: (invitationId: string, senderId: string, activityType: string) => void;
  onDeclineInvite?: (invitationId: string) => void;
}

const ConversationRow = ({ 
  item, 
  onSelect,
  onAcceptInvite,
  onDeclineInvite,
}: ConversationRowProps) => {
  const timeAgo = item.lastActivityAt.getTime() > 0 
    ? formatDistanceToNow(item.lastActivityAt, { addSuffix: false })
    : '';

  const isPendingInvite = item.type === 'pending_invite';
  const hasUnread = item.unreadCount > 0;
  const isSpot = item.type === 'spot';

  return (
    <div
      className={`
        flex items-center gap-3 p-3 rounded-xl transition-colors cursor-pointer
        ${isPendingInvite 
          ? 'bg-warning/10 border border-warning/30 hover:bg-warning/20' 
          : 'hover:bg-muted/50'
        }
        ${hasUnread ? 'bg-primary/5' : ''}
      `}
      onClick={() => !isPendingInvite && onSelect(item)}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {isSpot ? (
          <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Megaphone className="w-6 h-6 text-primary" />
          </div>
        ) : (
          <div className="w-12 h-12">
            <AvatarDisplay
              config={item.avatarConfig}
              size={48}
              showGlow={false}
            />
          </div>
        )}
        
        {/* Pending invite indicator */}
        {isPendingInvite && (
          <div className="absolute -top-1 -right-1">
            <Radio className="w-4 h-4 text-warning animate-pulse" />
          </div>
        )}
        
        {/* Unread badge */}
        {hasUnread && (
          <div className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center">
            {item.unreadCount > 9 ? '9+' : item.unreadCount}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h4 className={`font-semibold text-sm truncate ${hasUnread ? 'text-foreground' : 'text-foreground'}`}>
            {item.title}
          </h4>
          {timeAgo && (
            <span className={`text-xs flex-shrink-0 ${hasUnread ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
              {timeAgo}
            </span>
          )}
        </div>
        <p className={`text-xs truncate mt-0.5 ${
          isPendingInvite 
            ? 'text-warning font-medium' 
            : hasUnread 
              ? 'text-foreground font-medium' 
              : 'text-muted-foreground'
        }`}>
          {item.subtitle}
        </p>
        
        {/* Invite action buttons */}
        {isPendingInvite && onAcceptInvite && onDeclineInvite && (
          <div className="flex gap-2 mt-2">
            <Button
              size="sm"
              className="flex-1 h-8 bg-success hover:bg-success/90 text-success-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onAcceptInvite(item.invitationId!, item.senderId!, item.activityType!);
              }}
            >
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 border-destructive/50 text-destructive hover:bg-destructive/10"
              onClick={(e) => {
                e.stopPropagation();
                onDeclineInvite(item.invitationId!);
              }}
            >
              Decline
            </Button>
          </div>
        )}
      </div>

      {/* Type badge for spots */}
      {isSpot && (
        <Badge variant="outline" className="bg-primary/20 text-primary border-primary/40 text-xs capitalize flex-shrink-0">
          {item.category}
        </Badge>
      )}
    </div>
  );
};

export default ConversationRow;
