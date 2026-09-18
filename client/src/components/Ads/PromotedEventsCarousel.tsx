import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import EventCard from "@/components/Events/EventCard";
import { EventInterface } from "@shared/schema";
import { useLocation } from "@/hooks/useLocation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface PromotedEvent extends EventInterface {
  promotionId: number;
  isPromoted: boolean;
}

interface PromotedEventsCarouselProps {
  onEventClick?: (event: EventInterface) => void;
  onEventHover?: (eventId: number | null) => void;
  hoveredEventId?: number | null;
}

export function PromotedEventsCarousel({ onEventClick, onEventHover, hoveredEventId }: PromotedEventsCarouselProps) {
  const { location } = useLocation();
  const isMobile = useIsMobile();
  const [currentPage, setCurrentPage] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackedRef = useRef<Set<number>>(new Set());
  const trackingSessionRef = useRef(`promoted-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  const { data: promotedEvents = [] } = useQuery<PromotedEvent[]>({
    queryKey: ["/api/promotions/active", location?.lat, location?.lng],
    queryFn: async () => {
      if (!location) return [];
      const params = new URLSearchParams({
        lat: location.lat.toString(),
        lng: location.lng.toString(),
      });
      const res = await fetch(`/api/promotions/active?${params.toString()}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!location,
    staleTime: 2 * 60 * 1000,
  });

  const itemsPerPage = isMobile ? 1 : 2;
  const totalPages = Math.ceil(promotedEvents.length / itemsPerPage);

  const trackImpression = useCallback((promotionId: number) => {
    if (trackedRef.current.has(promotionId)) return;
    trackedRef.current.add(promotionId);
    fetch(`/api/promotions/${promotionId}/impression`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idempotencyKey: `${trackingSessionRef.current}:impression:${promotionId}` }),
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (promotedEvents.length === 0) return;
    const start = currentPage * itemsPerPage;
    const visible = promotedEvents.slice(start, start + itemsPerPage);
    visible.forEach((e) => trackImpression(e.promotionId));
  }, [currentPage, promotedEvents, itemsPerPage, trackImpression]);

  useEffect(() => {
    if (totalPages <= 1 || isPaused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setCurrentPage((prev) => (prev + 1) % totalPages);
    }, 8000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [totalPages, isPaused]);

  if (promotedEvents.length === 0) return null;

  const start = currentPage * itemsPerPage;
  const visibleEvents = promotedEvents.slice(start, start + itemsPerPage);

  const handleClick = (event: PromotedEvent) => {
    fetch(`/api/promotions/${event.promotionId}/click`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: event.id,
        idempotencyKey: `${trackingSessionRef.current}:click:${event.promotionId}`,
      }),
    }).catch(() => {});
    onEventClick?.(event);
  };

  return (
    <div
      className="mb-4"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-amber-600 uppercase tracking-wide">Gepromoot</span>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((prev) => (prev - 1 + totalPages) % totalPages)}
              className="p-1 rounded-full hover:bg-muted transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCurrentPage((prev) => (prev + 1) % totalPages)}
              className="p-1 rounded-full hover:bg-muted transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}>
        {visibleEvents.map((event) => (
          <div
            key={event.id}
            onMouseEnter={() => onEventHover?.(event.id)}
            onMouseLeave={() => onEventHover?.(null)}
          >
            <EventCard
              event={event}
              gridView={true}
              onEventClick={() => handleClick(event)}
              isHighlighted={hoveredEventId === event.id}
              isPromoted={true}
            />
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentPage(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === currentPage ? "bg-amber-500 w-4" : "bg-gray-300"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
