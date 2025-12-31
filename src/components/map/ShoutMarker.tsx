import { MessageSquare, Heart, MessageCircle } from 'lucide-react';

interface ShoutMarkerProps {
  content: string;
  createdAt: string;
  likesCount?: number;
  commentsCount?: number;
  onClick?: () => void;
}

const ShoutMarker = ({ content, createdAt, likesCount = 0, commentsCount = 0, onClick }: ShoutMarkerProps) => {
  // Calculate opacity based on age (fades slightly as shout ages)
  const createdTime = new Date(createdAt).getTime();
  const now = Date.now();
  const elapsed = now - createdTime;
  const thirtyMin = 30 * 60 * 1000;
  const remaining = Math.max(0, thirtyMin - elapsed);
  const progress = remaining / thirtyMin;
  const opacity = Math.max(0.7, 0.7 + (progress * 0.3));

  return (
    <div 
      className="shout-marker cursor-pointer group"
      onClick={onClick}
      style={{ opacity }}
    >
      {/* Speech bubble container */}
      <div className="relative flex flex-col items-center">
        {/* Main bubble */}
        <div className="relative bg-card/95 backdrop-blur-sm border-2 border-accent/60 rounded-xl px-3 py-2 shadow-lg max-w-[180px] transform transition-all duration-200 group-hover:scale-105 group-hover:shadow-xl">
          {/* Icon + Content */}
          <div className="flex items-start gap-2">
            <MessageSquare className="w-4 h-4 text-accent shrink-0 mt-0.5" />
            <p className="text-xs font-nunito text-foreground line-clamp-3 break-words leading-relaxed">
              {content}
            </p>
          </div>
          
          {/* Social counters */}
          <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1">
              <Heart className="w-3 h-3 text-rose-400" />
              <span className="font-medium">{likesCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <MessageCircle className="w-3 h-3 text-accent" />
              <span className="font-medium">{commentsCount}</span>
            </div>
          </div>
        </div>
        
        {/* Pointer/tail */}
        <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-accent/60 -mt-[1px]" />
      </div>
    </div>
  );
};

export default ShoutMarker;
