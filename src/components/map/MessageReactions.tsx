import { useState } from 'react';
import { SmilePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { REACTION_EMOJIS, type ReactionEmoji } from '@/hooks/useMessageReactions';

interface Reaction {
  emoji: string;
  count: number;
  hasReacted: boolean;
}

interface MessageReactionsProps {
  reactions: Reaction[];
  onToggleReaction: (emoji: string) => void;
  isOwn: boolean;
}

const MessageReactions = ({ reactions, onToggleReaction, isOwn }: MessageReactionsProps) => {
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleEmojiClick = (emoji: ReactionEmoji) => {
    onToggleReaction(emoji);
    setPickerOpen(false);
  };

  return (
    <div className={`flex items-center gap-1 flex-wrap ${isOwn ? 'justify-end' : 'justify-start'}`}>
      {/* Existing reactions as pills */}
      {reactions.map((reaction) => (
        <button
          key={reaction.emoji}
          onClick={() => onToggleReaction(reaction.emoji)}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors ${
            reaction.hasReacted
              ? 'bg-primary/20 border border-primary/40 text-foreground'
              : 'bg-muted/60 border border-border/50 text-muted-foreground hover:bg-muted'
          }`}
        >
          <span>{reaction.emoji}</span>
          <span className="font-medium">{reaction.count}</span>
        </button>
      ))}

      {/* Add reaction button */}
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 rounded-full opacity-60 hover:opacity-100 hover:bg-muted/60"
          >
            <SmilePlus className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          side={isOwn ? 'left' : 'right'} 
          align="center"
          className="w-auto p-2"
        >
          <div className="flex gap-1">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleEmojiClick(emoji)}
                className="p-2 text-lg hover:bg-muted rounded-lg transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default MessageReactions;
