import { formatDistanceToNow } from 'date-fns';
import { Radio } from 'lucide-react';
import AvatarDisplay from '@/components/avatar/AvatarDisplay';
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

  return (
    <div
      className={`
        flex items-center gap-3 p-3 rounded-xl transition-colors cursor-pointer w-full overflow-hidden
        ${isPendingInvite 
          ? 'bg-warning/10 border border-warning/30 hover:bg-warning/20' 
          : 'hover:bg-muted/50'
        }
        ${hasUnread ? 'bg-primary/5' : ''}
      `}
      onClick={() => !isPendingInvite && onSelect(item)}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0 w-12 h-12">
        <AvatarDisplay
          config={item.avatarConfig}
          size={48}
          showGlow={false}
        />
        
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

      {/* Content - takes remaining space with overflow handling */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex items-center gap-2">
          <h4 className={`font-semibold text-sm truncate flex-1 min-w-0 ${hasUnread ? 'text-foreground' : 'text-foreground'}`}>
            {item.title}
          </h4>
          {timeAgo && (
            <span className={`text-xs flex-shrink-0 whitespace-nowrap ${hasUnread ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
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
              className="flex-1 h-8"
              onClick={(e) => {
                e.stopPropagation();
                onAcceptInvite(item.invitationId!, item.senderId!, item.activityType!);
              }}
            >
              Accept
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="flex-1 h-8"
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
    </div>
  );
};

export default ConversationRow;
