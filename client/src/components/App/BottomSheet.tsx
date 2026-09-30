import * as React from "react";
import { motion, PanInfo, useReducedMotion } from "framer-motion";
import { EventInterface as Event } from "@shared/schema";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/CategoryIcon";
import { MapPin, Loader2, Eye, EyeOff, X, Heart, Map, PanelsTopLeft, LayoutList } from "lucide-react";
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

type SheetMode = "map" | "hybrid" | "tiles";
const COLLAPSED_HEIGHT = 116;
const EXPANDED_HEIGHT_RATIO = 0.55;
const FALLBACK_BOTTOM_NAV_HEIGHT = 76;
const PAGE_SIZE = 20;
const MODES: { mode: SheetMode; label: string; Icon: typeof Map }[] = [
  { mode: "map", label: "Kaart", Icon: Map },
  { mode: "hybrid", label: "Combinatie", Icon: PanelsTopLeft },
  { mode: "tiles", label: "Tegels", Icon: LayoutList },
];

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
  const [mode, setMode] = React.useState<SheetMode>(isOpen ? "hybrid" : "map");
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [displayCount, setDisplayCount] = React.useState(PAGE_SIZE);
  const [bottomNavHeight, setBottomNavHeight] = React.useState(FALLBACK_BOTTOM_NAV_HEIGHT);
  const [headerBottom, setHeaderBottom] = React.useState(72);
  const [viewportHeight, setViewportHeight] = React.useState(typeof window === "undefined" ? 800 : window.innerHeight);
  const reducedMotion = useReducedMotion();
  const { user } = useAuth();

  // Keep a narrow strip of the actual map (including its filter button) in view.
  const fullHeight = Math.max(COLLAPSED_HEIGHT, viewportHeight - headerBottom - bottomNavHeight - 76);
  const hybridHeight = Math.min(fullHeight, Math.max(COLLAPSED_HEIGHT, viewportHeight * EXPANDED_HEIGHT_RATIO));
  const sheetHeight = mode === "map" ? COLLAPSED_HEIGHT : mode === "hybrid" ? hybridHeight : fullHeight;

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
    if (isOpen) setMode("hybrid");
  }, [isOpen]);

  React.useEffect(() => {
    setDisplayCount(PAGE_SIZE);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [events]);

  React.useEffect(() => {
    const bottomNav = document.querySelector<HTMLElement>('.app-bottom-nav');
    const header = document.querySelector<HTMLElement>('.app-main-header');
    const updateDimensions = () => {
      if (bottomNav) setBottomNavHeight(bottomNav.getBoundingClientRect().height);
      if (header) setHeaderBottom(header.getBoundingClientRect().bottom);
      setViewportHeight(window.innerHeight);
    };

    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    if (bottomNav) observer.observe(bottomNav);
    if (header) observer.observe(header);
    window.addEventListener("resize", updateDimensions);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateDimensions);
    };
  }, []);

  React.useEffect(() => {
    if (mode === "map" || !sentinelRef.current) return;

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
  }, [mode, displayCount, events.length]);

  const changeMode = (next: SheetMode) => {
    setMode(next);
    onOpenChange?.(next !== "map");
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y < -35 || info.velocity.y < -300) {
      changeMode(mode === "map" ? "hybrid" : "tiles");
    } else if (info.offset.y > 35 || info.velocity.y > 300) {
      changeMode(mode === "tiles" ? "hybrid" : "map");
    }
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
  const visibleEvents = mode !== "map" ? filteredByHidden.slice(0, displayCount) : filteredByHidden.slice(0, 4);
  const hasMore = mode !== "map" && displayCount < filteredByHidden.length;

  return (
    <motion.div
      className="fixed left-0 right-0 bg-background rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.15)] z-40 overflow-hidden flex flex-col"
      style={{ bottom: bottomNavHeight }}
      initial={false}
      animate={{ height: sheetHeight }}
      transition={reducedMotion ? { duration: 0 } : { type: "spring", damping: 32, stiffness: 320 }}
      aria-label="Evenementenweergave"
    >
      <div className="flex flex-col h-full min-h-0">
        <motion.button
          type="button"
          className="drag-handle flex shrink-0 justify-center items-center py-2 cursor-grab active:cursor-grabbing touch-none"
          aria-label={mode === "tiles" ? "Schuif omlaag naar gecombineerde weergave" : "Schuif omhoog naar meer evenementen"}
          onClick={() => changeMode(mode === "map" ? "hybrid" : mode === "hybrid" ? "tiles" : "hybrid")}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.12}
          onDragEnd={handleDragEnd}
        >
          <motion.div
            className="w-12 h-1.5 bg-muted-foreground/40 rounded-full"
            animate={reducedMotion ? undefined : {
              scaleX: [1, 1.2, 1],
              opacity: [0.55, 0.9, 0.55],
            }}
            transition={{
              duration: 1.8,
              repeat: Infinity,
              repeatDelay: 2.5,
              ease: "easeInOut",
            }}
          />
        </motion.button>
        
        <div className="px-4 pb-1 text-center shrink-0">
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
                  if (newVal) changeMode("hybrid");
                }}
                className="text-xs text-muted-foreground mt-0.5 mx-auto flex items-center gap-1 hover:text-foreground transition-colors"
              >
                {showHidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                <span>{showHidden ? 'Verberg verborgen' : `${hiddenCount} verborgen – toon`}</span>
              </button>
            );
          })()}
        </div>

        <div className="mx-auto mb-2 flex shrink-0 items-center gap-1 rounded-full border border-border/70 bg-muted/60 p-0.5" role="group" aria-label="Kies weergave">
          {MODES.map(({ mode: option, label, Icon }) => (
            <button
              key={option}
              type="button"
              onClick={() => changeMode(option)}
              aria-label={`${label}weergave`}
              aria-pressed={mode === option}
              className={cn(
                "relative isolate flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                mode === option ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {mode === option && <motion.span layoutId="sheet-mode-highlight" className="absolute inset-0 -z-10 rounded-full bg-primary" transition={reducedMotion ? { duration: 0 } : { type: "spring", damping: 28, stiffness: 340 }} />}
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
        
        <div
          ref={scrollRef}
          className={cn(
            "flex-1 overflow-y-auto px-3 pb-6",
            mode === "map" && "overflow-hidden bottom-sheet-collapsed-content"
          )}
        >
          {mode !== "map" && filteredByHidden.length === 0 && (
            <p className="mx-auto max-w-sm px-5 py-10 text-center text-sm text-muted-foreground">
              Geen evenementen in dit kaartgebied. Verplaats de kaart of pas je filters aan.
            </p>
          )}
          <div className={cn("mx-auto grid w-full gap-3 pb-4", mode === "tiles" ? "max-w-2xl grid-cols-1" : "grid-cols-2")}>
            {visibleEvents.map((event) => {
              const favd = isFavorited(event.id);
              return (
                <div
                  key={event.id}
                  onClick={() => onEventClick?.(event)}
                  className={cn("bg-card rounded-xl overflow-hidden shadow-sm border cursor-pointer hover:shadow-md transition-shadow", mode === "tiles" && "flex min-h-36")}
                >
                  <div className={cn("relative bg-muted", mode === "tiles" ? "w-[38%] min-h-36 shrink-0" : "h-24")}>
                    {(() => {
                      const displayImage = event.imageUrl || getDeterministicCategoryImage(event.category, event.id);
                      const isStockPhoto = !event.imageUrl;
                      return (
                        <>
                          <img
                            src={displayImage}
                            alt={event.title}
                            className={cn("w-full h-full object-cover", mode === "tiles" && "absolute inset-0")}
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
                      aria-label={isHidden?.(event.id) ? 'Evenement tonen' : 'Evenement verbergen'}
                      title={isHidden?.(event.id) ? 'Evenement tonen' : 'Evenement verbergen'}
                    >
                      <X className="h-3 w-3" />
                    </button>

                  </div>
                  
                  <div className={cn("p-2 min-w-0", mode === "tiles" && "flex flex-1 flex-col justify-center gap-1.5 px-3 py-3")}>
                    <h3 className={cn("font-medium text-sm leading-tight mb-1", mode === "tiles" ? "line-clamp-3 text-base" : "line-clamp-2 pr-5")}>
                      {event.title}
                    </h3>
                    {mode === "tiles" && event.description && (
                      <p className="text-xs leading-relaxed text-muted-foreground line-clamp-3">
                        {event.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()}
                      </p>
                    )}
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
                        aria-label={favd ? 'Verwijder uit opgeslagen' : 'Opslaan'}
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
