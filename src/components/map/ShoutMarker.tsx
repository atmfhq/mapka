import { MessageSquare } from 'lucide-react';

interface ShoutMarkerProps {
  content: string;
  createdAt: string;
  onClick?: () => void;
}

const ShoutMarker = ({ content, createdAt, onClick }: ShoutMarkerProps) => {
  // Calculate remaining time (30 min lifecycle)
  const createdTime = new Date(createdAt).getTime();
  const now = Date.now();
  const elapsed = now - createdTime;
  const thirtyMin = 30 * 60 * 1000;
  const remaining = Math.max(0, thirtyMin - elapsed);
  
  // Progress from 0 to 1 (1 = full/fresh, 0 = expired)
  const progress = remaining / thirtyMin;
  
  // Color based on urgency: green (>66%) → yellow (33-66%) → red (<33%)
  const getBarColor = () => {
    if (progress > 0.66) return 'bg-emerald-500';
    if (progress > 0.33) return 'bg-amber-500';
    return 'bg-red-500';
  };
  
  // Opacity fades slightly as shout ages (but not too much for readability)
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
          
          {/* Progress bar */}
          <div className="mt-2 h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-1000 ${getBarColor()}`}
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
        
        {/* Pointer/tail */}
        <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-accent/60 -mt-[1px]" />
      </div>
    </div>
  );
};

export default ShoutMarker;
