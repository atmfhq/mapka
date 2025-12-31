import { MessageCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ShoutMarkerProps {
  content: string;
  createdAt: string;
  onClick?: () => void;
}

const ShoutMarker = ({ content, createdAt, onClick }: ShoutMarkerProps) => {
  const timeAgo = formatDistanceToNow(new Date(createdAt), { addSuffix: true });
  
  // Calculate remaining time (30 min lifecycle)
  const createdTime = new Date(createdAt).getTime();
  const now = Date.now();
  const elapsed = now - createdTime;
  const thirtyMin = 30 * 60 * 1000;
  const remaining = Math.max(0, thirtyMin - elapsed);
  const remainingMinutes = Math.ceil(remaining / 60000);
  
  // Opacity fades as shout ages
  const opacity = Math.max(0.4, remaining / thirtyMin);

  return (
    <div 
      className="shout-marker cursor-pointer group"
      onClick={onClick}
      style={{ opacity }}
    >
      {/* Speech bubble */}
      <div className="relative bg-card/95 backdrop-blur-sm border-2 border-accent/60 rounded-xl px-3 py-2 shadow-lg max-w-[200px] transform transition-all duration-200 group-hover:scale-105">
        {/* Content */}
        <p className="text-xs font-nunito text-foreground line-clamp-3 break-words">
          {content}
        </p>
        
        {/* Timer */}
        <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground">
          <MessageCircle className="w-3 h-3 text-accent" />
          <span>{remainingMinutes}m left</span>
        </div>
        
        {/* Pointer/tail */}
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-accent/60" />
      </div>
    </div>
  );
};

export default ShoutMarker;
