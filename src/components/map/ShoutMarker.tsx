import { Heart, MessageCircle, X } from 'lucide-react';

interface ShoutMarkerProps {
  content: string;
  createdAt: string;
  likesCount?: number;
  commentsCount?: number;
  onClick?: () => void;
  onHide?: () => void;
  canHide?: boolean;
  isOwn?: boolean;
}

const ShoutMarker = ({ content, createdAt, likesCount = 0, commentsCount = 0, onClick, onHide, canHide = false, isOwn = false }: ShoutMarkerProps) => {
  // Calculate opacity based on age (fades slightly as shout ages over 24 hours)
  const createdTime = new Date(createdAt).getTime();
  const now = Date.now();
  const elapsed = now - createdTime;
  const twentyFourHours = 24 * 60 * 60 * 1000;
  const remaining = Math.max(0, twentyFourHours - elapsed);
  const progress = remaining / twentyFourHours;
  const opacity = Math.max(0.7, 0.7 + (progress * 0.3));

  const handleHideClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onHide?.();
  };

  return (
    <div 
      className="shout-marker cursor-pointer group"
      onClick={onClick}
      style={{ opacity }}
    >
      {/* Speech bubble container */}
      <div className="relative flex flex-col items-center">
        {/* Main bubble */}
        <div className={`relative bg-card/95 backdrop-blur-sm rounded-xl px-3 py-2 shadow-lg max-w-[180px] min-w-[80px] transform transition-all duration-200 group-hover:scale-105 group-hover:shadow-xl ${
          isOwn 
            ? 'border-[3px] border-primary' 
            : 'border-2 border-accent/60'
        }`}>
          {/* Hide button */}
          {canHide && (
            <button
              onClick={handleHideClick}
              className="absolute -top-2 -right-2 w-5 h-5 bg-muted hover:bg-destructive rounded-full flex items-center justify-center transition-colors shadow-md opacity-0 group-hover:opacity-100 z-10"
              title="Hide this shout"
            >
              <X className="w-3 h-3 text-muted-foreground hover:text-destructive-foreground" />
            </button>
          )}
          
          {/* Text content only */}
          <p className="text-xs font-nunito text-foreground line-clamp-3 break-words leading-relaxed">
            {content}
          </p>
          
          {/* Social counters */}
          <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
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
        <div className={`w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] -mt-[1px] ${
          isOwn ? 'border-t-primary' : 'border-t-accent/60'
        }`} />
      </div>
    </div>
  );
};

export default ShoutMarker;
