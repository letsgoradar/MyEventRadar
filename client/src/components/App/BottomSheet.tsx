import * as React from "react";
import { motion, PanInfo } from "framer-motion";
import { EventInterface as Event } from "@shared/schema";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/CategoryIcon";
import { MapPin, Loader2, Eye, EyeOff, X, Heart } from "lucide-react";
import { formatDutchShortDate } from "@/utils/date-utils";
import { getDeterministicCategoryImage } from "@/lib/categoryImages";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

function extractCity(address: string | null | undefined): string | null {
  if (!address) return null;
  const parts = address.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1];
    const secondLast = parts[parts.length - 2];
    if (/^\d{4}\s?[A-Z]{2}/.test(secondLast)) {
      return secondLast.replace(/^\d{4}\s?[A-Z]{2}\s*/, '').trim() || lastPart;
    }
    return secondLast;
  }
  return parts[0];
}

interface BottomSheetProps {
  events: Event[];
  onEventClick?: (event: Event) => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  isHidden?: (eventId: number) => boolean;
  onHideToggle?: (eventId: number) => void;
  showHidden?: boolean;
  onShowHiddenChange?: (show: boolean) => void;
  onRequireAuth?: () => void;
}

const COLLAPSED_HEIGHT = 50;
const EXPANDED_HEIGHT_RATIO = 0.55;
const BOTTOM_NAV_HEIGHT = 70;
const PAGE_SIZE = 20;

export function BottomSheet({ 
  events, 
  onEventClick,
  isOpen = false,
  onOpenChange,
  isHidden,
  onHideToggle,
  showHidden = false,
  onShowHiddenChange,
  onRequireAuth,
}: BottomSheetProps) {
  const [isExpanded, setIsExpanded] = React.useState(isOpen);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [displayCount, setDisplayCount] = React.useState(PAGE_SIZE);
  const { user } = useAuth();

  const expandedHeight = typeof window !== 'undefined' 
    ? window.innerHeight * EXPANDED_HEIGHT_RATIO 
    : 400;

  const { data: favorites = [] } = useQuery<any[]>({
    queryKey: ['/api/events/favorites'],
    enabled: !!user,
  });

  const favoriteMutation = useMutation({
    mutationFn: async ({ eventId, isFav }: { eventId: number; isFav: boolean }) => {
      if (isFav) {
        await apiRequest(`/api/events/${eventId}/unfavorite`, { method: 'DELETE' });
      } else {
        await apiRequest(`/api/events/${eventId}/favorite`, { method: 'POST' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events/favorites'] });
      queryClient.invalidateQueries({ queryKey: [`/api/favorites/${user?.id}`] });
    },
  });

  const isFavorited = (eventId: number) =>
    Array.isArray(favorites) && favorites.some((f: any) => f.id === eventId);

  React.useEffect(() => {
    setIsExpanded(isOpen);
  }, [isOpen]);

  React.useEffect(() => {
    setDisplayCount(PAGE_SIZE);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [events]);

  React.useEffect(() => {
    if (!isExpanded || !sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && displayCount < events.length) {
          setDisplayCount(prev => Math.min(prev + PAGE_SIZE, events.length));
        }
      },
      { root: scrollRef.current, rootMargin: "200px" }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [isExpanded, displayCount, events.length]);

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
    const now = new Date();
    const start = new Date(event.startTime);
    const end = event.endTime ? new Date(event.endTime) : start;
    
    const eventStartDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const eventEndDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    
    const isMultiDay = eventEndDay.getTime() > eventStartDay.getTime();
    const isAlreadyStarted = start < now;
    const isStillOngoing = end > now;
    
    if (isMultiDay && isAlreadyStarted && isStillOngoing) {
      return formatDutchShortDate(now);
    }
    
    return formatDutchShortDate(start);
  };

  const filteredByHidden = isHidden && !showHidden
    ? events.filter(e => !isHidden(e.id))
    : events;
  const visibleEvents = isExpanded ? filteredByHidden.slice(0, displayCount) : filteredByHidden.slice(0, 4);
  const hasMore = isExpanded && displayCount < filteredByHidden.length;

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
          <div className="w-12 h-1.5 bg-muted-foreground/40 rounded-full" />
        </div>
        
        <div className="px-4 pb-2">
          <p className="text-sm text-muted-foreground font-medium">
            {filteredByHidden.length} {filteredByHidden.length === 1 ? 'evenement' : 'evenementen'}
          </p>
          {isHidden && (() => {
            const hiddenCount = events.filter(e => isHidden(e.id)).length;
            if (hiddenCount <= 0) return null;
            return (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const newVal = !showHidden;
                  onShowHiddenChange?.(newVal);
                  if (newVal) { onOpenChange?.(true); setIsExpanded(true); }
                }}
                className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 hover:text-foreground transition-colors"
              >
                {showHidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                <span>{showHidden ? 'Verberg verborgen' : `${hiddenCount} verborgen – toon`}</span>
              </button>
            );
          })()}
        </div>
        
        <div
          ref={scrollRef}
          className={cn(
            "flex-1 overflow-y-auto px-3 pb-6",
            !isExpanded && "overflow-hidden"
          )}
        >
          <div className="grid grid-cols-2 gap-3 pb-4">
            {visibleEvents.map((event) => {
              const favd = isFavorited(event.id);
              return (
                <div
                  key={event.id}
                  onClick={() => onEventClick?.(event)}
                  className="bg-card rounded-xl overflow-hidden shadow-sm border cursor-pointer hover:shadow-md transition-shadow"
                >
                  <div className="relative h-24 bg-muted">
                    {(() => {
                      const displayImage = event.imageUrl || getDeterministicCategoryImage(event.category, event.id);
                      const isStockPhoto = !event.imageUrl;
                      return (
                        <>
                          <img
                            src={displayImage}
                            alt={event.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          {isStockPhoto && (
                            <div className="absolute bottom-1 right-1">
                              <span className="bg-black/50 text-white text-[9px] px-1 py-0.5 rounded">
                                Stockfoto
                              </span>
                            </div>
                          )}
                        </>
                      );
                    })()}

                    {/* Datum badge links-boven */}
                    <div className="absolute top-1.5 left-1.5">
                      <div className="bg-[#1A2B3C]/80 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs font-medium text-white">
                        {formatEventTime(event)}
                      </div>
                    </div>

                    {/* X knop rechts-boven: verberg */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!user) { onRequireAuth?.(); return; }
                        onHideToggle?.(event.id);
                      }}
                      className="absolute top-1.5 right-1.5 z-10 bg-black/50 hover:bg-black/70 text-white p-1 rounded-full transition-colors"
                      title={isHidden?.(event.id) ? 'Evenement tonen' : 'Evenement verbergen'}
                    >
                      <X className="h-3 w-3" />
                    </button>

                  </div>
                  
                  <div className="p-2">
                    <h3 className="font-medium text-sm line-clamp-2 leading-tight mb-1 pr-5">
                      {event.title}
                    </h3>
                    <div className="flex items-center justify-between gap-1">
                      {event.address ? (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-0">
                          <MapPin className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{extractCity(event.address)}</span>
                        </div>
                      ) : <div />}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!user) { onRequireAuth?.(); return; }
                          favoriteMutation.mutate({ eventId: event.id, isFav: favd });
                        }}
                        className="flex-shrink-0 p-0.5 rounded transition-colors hover:scale-110"
                        title={favd ? 'Verwijder uit opgeslagen' : 'Opslaan'}
                      >
                        <Heart className={`h-4 w-4 ${favd ? 'fill-red-500 stroke-red-500' : 'stroke-gray-400 fill-transparent'}`} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {hasMore && (
            <div ref={sentinelRef} className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default BottomSheet;
