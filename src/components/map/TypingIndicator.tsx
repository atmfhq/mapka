import { memo } from 'react';

interface TypingIndicatorProps {
  userName?: string;
}

const TypingIndicator = memo(({ userName }: TypingIndicatorProps) => {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <div className="flex gap-1">
        <span 
          className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" 
          style={{ animationDelay: '0ms', animationDuration: '600ms' }} 
        />
        <span 
          className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" 
          style={{ animationDelay: '150ms', animationDuration: '600ms' }} 
        />
        <span 
          className="w-2 h-2 rounded-full bg-muted-foreground/60 animate-bounce" 
          style={{ animationDelay: '300ms', animationDuration: '600ms' }} 
        />
      </div>
      <span className="text-xs text-muted-foreground">
        {userName ? `${userName} is typing...` : 'typing...'}
      </span>
    </div>
  );
});

TypingIndicator.displayName = 'TypingIndicator';

export default TypingIndicator;
