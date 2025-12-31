import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

// Common emoji categories with popular emojis
const EMOJI_CATEGORIES = [
  {
    name: 'Activities',
    emojis: ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🏒', '🏑', '🥏', '🏊', '🚴', '🏃', '🎿', '🏂', '⛷️', '🎳', '🥊', '🤼', '🏋️', '🤸', '⛹️', '🧘', '🎯', '🎮', '🎲', '♟️', '🎪', '🎭', '🎨', '🎬', '🎤', '🎧', '🎵', '🎹', '🎸', '🎷', '🎺', '🥁']
  },
  {
    name: 'Food & Drink',
    emojis: ['🍕', '🍔', '🍟', '🌭', '🍿', '🧂', '🥓', '🥚', '🍳', '🧇', '🥞', '🧈', '🍞', '🥐', '🥖', '🥨', '🧀', '🥗', '🥙', '🌮', '🌯', '🥪', '🍱', '🍣', '🍜', '🍝', '🍛', '🍲', '🍤', '🍚', '🍙', '🍘', '🍥', '🥠', '🥡', '🍦', '🍧', '🍨', '🍩', '🍪', '🎂', '🍰', '🧁', '🥧', '🍫', '🍬', '🍭', '🍮', '🍯', '☕', '🍵', '🧃', '🥤', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉']
  },
  {
    name: 'Nature',
    emojis: ['🌲', '🌳', '🌴', '🌵', '🌾', '🌿', '🍀', '🍁', '🍂', '🍃', '🌺', '🌻', '🌹', '🌷', '🌸', '💐', '🌼', '🏔️', '⛰️', '🌋', '🏕️', '🏖️', '🏜️', '🏝️', '🌅', '🌄', '🌠', '🌌', '🌈', '⛅', '☀️', '🌙', '⭐', '🔥', '💧', '🌊', '❄️', '☃️', '⛄']
  },
  {
    name: 'Objects',
    emojis: ['📱', '💻', '🖥️', '🖨️', '⌨️', '🖱️', '📷', '📹', '🎥', '📽️', '📺', '📻', '🎙️', '📀', '💿', '📼', '🔋', '🔌', '💡', '🔦', '🕯️', '📕', '📖', '📚', '🎒', '👓', '🕶️', '👔', '👗', '👠', '👟', '🧢', '👑', '💍', '💎', '🏆', '🎖️', '🏅', '🥇', '🥈', '🥉']
  },
  {
    name: 'Symbols',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '✨', '⭐', '🌟', '💫', '⚡', '🔥', '💥', '❄️', '🎉', '🎊', '🎈', '🎀', '✅', '❌', '⭕', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤']
  },
  {
    name: 'People',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕']
  },
  {
    name: 'Animals',
    emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🐇', '🦝', '🦨', '🦡', '🦦', '🦥']
  },
  {
    name: 'Travel',
    emojis: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🛵', '🏍️', '🚲', '🛴', '🚨', '🚔', '🚍', '🚘', '🚖', '✈️', '🛫', '🛬', '🛩️', '🚀', '🛸', '🚁', '🛶', '⛵', '🚤', '🛥️', '🛳️', '⛴️', '🚢', '⚓', '🗼', '🗽', '🗿', '🏰', '🏯', '🏟️', '🎡', '🎢', '🎠', '⛲', '⛱️', '🏖️', '🏕️', '🏔️', '🗻', '🌋', '🏜️', '🏝️']
  }
];

interface EmojiPickerProps {
  value: string | null;
  onChange: (emoji: string) => void;
  className?: string;
}

export const EmojiPicker = ({ value, onChange, className }: EmojiPickerProps) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const displayEmojis = selectedCategory === 'all'
    ? EMOJI_CATEGORIES.flatMap(c => c.emojis)
    : EMOJI_CATEGORIES.find(c => c.name === selectedCategory)?.emojis || [];

  return (
    <div className={cn("space-y-3 w-full min-w-0", className)}>
      {/* Selected emoji display */}
      {value && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/10 border-2 border-primary/40">
          <span className="text-3xl">{value}</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-primary font-nunito">Selected Icon</p>
            <p className="text-xs text-muted-foreground">Tap below to change</p>
          </div>
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-sm text-muted-foreground hover:text-foreground shrink-0"
          >
            Clear
          </button>
        </div>
      )}

      {/* Category dropdown */}
      <Select value={selectedCategory} onValueChange={setSelectedCategory}>
        <SelectTrigger className="w-full bg-muted/50 border-border">
          <SelectValue placeholder="Select category" />
        </SelectTrigger>
        <SelectContent className="bg-popover border-border z-[100]">
          <SelectItem value="all">All Categories</SelectItem>
          {EMOJI_CATEGORIES.map(category => (
            <SelectItem key={category.name} value={category.name}>
              {category.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Emoji grid - vertical scroll with wrapping */}
      <ScrollArea className="h-[180px] w-full rounded-xl border border-border/50 bg-muted/20">
        <div className="p-2">
          <div className="flex flex-wrap gap-1">
            {displayEmojis.map((emoji, idx) => (
              <button
                key={`${selectedCategory}-${idx}`}
                type="button"
                onClick={() => onChange(emoji)}
                className={cn(
                  "w-10 h-10 flex items-center justify-center rounded-lg text-xl transition-all hover:bg-primary/20 hover:scale-105",
                  value === emoji && "bg-primary/30 ring-2 ring-primary"
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default EmojiPicker;
