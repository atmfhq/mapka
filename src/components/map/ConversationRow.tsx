import { formatDistanceToNow } from 'date-fns';
import { Radio } from 'lucide-react';
import AvatarDisplay from '@/components/avatar/AvatarDisplay';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ConversationItem } from '@/hooks/useUnifiedConversations';
import { ACTIVITIES, getCategoryForActivity, ACTIVITY_CATEGORIES } from '@/constants/activities';

interface ConversationRowProps {
  item: ConversationItem;
  onSelect: (item: ConversationItem) => void;
  onAcceptInvite?: (invitationId: string, senderId: string, activityType: string) => void;
  onDeclineInvite?: (invitationId: string) => void;
}

// Category colors matching TacticalMap marker styling (HSL format)
const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  sport: { bg: 'bg-[hsl(15,100%,55%)]/20', border: 'border-[hsl(15,100%,55%)]/40', text: 'text-[hsl(15,100%,55%)]' },
  tabletop: { bg: 'bg-[hsl(200,100%,50%)]/20', border: 'border-[hsl(200,100%,50%)]/40', text: 'text-[hsl(200,100%,50%)]' },
  social: { bg: 'bg-[hsl(45,100%,55%)]/20', border: 'border-[hsl(45,100%,55%)]/40', text: 'text-[hsl(45,100%,55%)]' },
  outdoor: { bg: 'bg-[hsl(145,70%,45%)]/20', border: 'border-[hsl(145,70%,45%)]/40', text: 'text-[hsl(145,70%,45%)]' },
};

// Get activity icon from category (label/id)
const getSpotIcon = (category: string): string => {
  // First try to find exact activity match
  const activity = ACTIVITIES.find(
    a => a.label.toLowerCase() === category.toLowerCase() || a.id.toLowerCase() === category.toLowerCase()
  );
  if (activity) return activity.icon;
  
  // Fallback to category icon
  const categoryInfo = ACTIVITY_CATEGORIES.find(c => c.id === category.toLowerCase());
  if (categoryInfo) return categoryInfo.icon;
  
  return '📍'; // Default fallback
};

// Get category color styles from category
const getCategoryStyles = (category: string): { bg: string; border: string; text: string } => {
  const categoryKey = getCategoryForActivity(category) || category.toLowerCase();
  return CATEGORY_COLORS[categoryKey] || { bg: 'bg-primary/20', border: 'border-primary/40', text: 'text-primary' };
};

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

  // Get icon and colors for spots
  const spotIcon = isSpot ? getSpotIcon(item.category || '') : null;
  const categoryStyles = isSpot ? getCategoryStyles(item.category || '') : null;

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
      {/* Avatar / Spot Icon */}
      <div className="relative flex-shrink-0 w-12 h-12">
        {isSpot && spotIcon && categoryStyles ? (
          <div className={`w-12 h-12 rounded-xl ${categoryStyles.bg} border ${categoryStyles.border} flex items-center justify-center`}>
            <span className="text-2xl">{spotIcon}</span>
          </div>
        ) : (
          <AvatarDisplay
            config={item.avatarConfig}
            size={48}
            showGlow={false}
          />
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
          {/* Type badge for spots - inline with timestamp */}
          {isSpot && categoryStyles && (
            <Badge variant="outline" className={`${categoryStyles.bg} ${categoryStyles.text} ${categoryStyles.border} text-[10px] capitalize flex-shrink-0 px-1.5 py-0`}>
              {item.category}
            </Badge>
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
    </div>
  );
};

export default ConversationRow;
