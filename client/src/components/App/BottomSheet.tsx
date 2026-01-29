import * as React from "react";
import { motion, PanInfo } from "framer-motion";
import { EventInterface as Event } from "@shared/schema";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { CategoryIcon } from "@/components/CategoryIcon";
import { MapPin, Clock } from "lucide-react";

interface BottomSheetProps {
  events: Event[];
  onEventClick?: (event: Event) => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const COLLAPSED_HEIGHT = 50;
const EXPANDED_HEIGHT_RATIO = 0.55;
const BOTTOM_NAV_HEIGHT = 60;

export function BottomSheet({ 
  events, 
  onEventClick,
  isOpen = false,
  onOpenChange
}: BottomSheetProps) {
  const [isExpanded, setIsExpanded] = React.useState(isOpen);
  const containerRef = React.useRef<HTMLDivElement>(null);
  
  const expandedHeight = typeof window !== 'undefined' 
    ? window.innerHeight * EXPANDED_HEIGHT_RATIO 
    : 400;

  React.useEffect(() => {
    setIsExpanded(isOpen);
  }, [isOpen]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.velocity.y < -300 || info.offset.y < -50) {
      setIsExpanded(true);
      onOpenChange?.(true);
    } else if (info.velocity.y > 300 || info.offset.y > 50) {
      setIsExpanded(false);
      onOpenChange?.(false);
    }
  };

  const toggleSheet = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    onOpenChange?.(newState);
  };

  const formatEventTime = (event: Event) => {
    const start = new Date(event.startTime);
    return format(start, "d MMM", { locale: nl });
  };

  return (
    <motion.div
      ref={containerRef}
      className="fixed left-0 right-0 bg-background rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.15)] z-40 overflow-hidden"
      style={{ 
        height: expandedHeight,
        bottom: BOTTOM_NAV_HEIGHT,
      }}
      animate={{
        y: isExpanded ? 0 : expandedHeight - COLLAPSED_HEIGHT
      }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      drag="y"
      dragConstraints={{ top: 0, bottom: expandedHeight - COLLAPSED_HEIGHT }}
      dragElastic={0.1}
      onDragEnd={handleDragEnd}
    >
      <div 
        className="flex flex-col h-full"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('.drag-handle')) {
            toggleSheet();
          }
        }}
      >
        <div className="drag-handle flex justify-center items-center py-3 cursor-grab active:cursor-grabbing">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>
        
        <div className="px-4 pb-2">
          <p className="text-sm text-muted-foreground font-medium">
            {events.length} {events.length === 1 ? 'evenement' : 'evenementen'}
          </p>
        </div>
        
        <div className={cn(
          "flex-1 overflow-y-auto px-3 pb-4",
          !isExpanded && "overflow-hidden"
        )}>
          <div className="grid grid-cols-2 gap-3">
            {events.slice(0, isExpanded ? undefined : 4).map((event) => (
              <div
                key={event.id}
                onClick={() => onEventClick?.(event)}
                className="bg-card rounded-xl overflow-hidden shadow-sm border cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="relative h-24 bg-muted">
                  {event.imageUrl ? (
                    <img 
                      src={event.imageUrl} 
                      alt={event.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/40">
                      <CategoryIcon category={event.category as any} size={32} className="text-primary" />
                    </div>
                  )}
                  <div className="absolute top-2 left-2">
                    <div className="bg-white/90 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs font-medium">
                      {formatEventTime(event)}
                    </div>
                  </div>
                </div>
                
                <div className="p-2">
                  <h3 className="font-medium text-sm line-clamp-2 leading-tight mb-1">
                    {event.title}
                  </h3>
                  {event.address && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{event.address}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default BottomSheet;
