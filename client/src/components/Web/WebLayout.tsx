import * as React from "react";
import type { EventInterface } from "@shared/schema";
import Header from "./Header";
import SplitView from "./SplitView";
import { EventDetailPanel } from "./EventDetailPanel";
import { addDays, startOfDay, endOfDay, eachDayOfInterval, differenceInDays } from "date-fns";
import { type EventFilterState, FilterSidebar } from "@/components/Filters/EventFilters";
import { Loader2, MapPin } from "lucide-react";
import { AuthModal } from "@/components/Auth/AuthModal";
import { useAuth } from "@/hooks/use-auth";

type ExtendedEvent = EventInterface & {
  eventTagIds?: number[];
  targetAudienceIds?: number[];
  seasonalThemeIds?: number[];
};

interface WebLayoutProps {
  children?: React.ReactNode;
  searchQuery?: string;
  radius?: number;
  filteredEvents?: ExtendedEvent[];
  onSearch?: (query: string) => void;
  onRadiusChange?: (radius: number) => void;
  onFilteredEventsChange?: (events: ExtendedEvent[]) => void;
  onEventClick?: (event: ExtendedEvent) => void;
  onWindowDaysChange?: (days: number | null) => void;
  isLoading?: boolean;
  isRefetching?: boolean;
}

export function WebLayout({ 
  children,
  searchQuery: propSearchQuery,
  radius: propRadius,
  filteredEvents: propFilteredEvents,
  onSearch: propOnSearch,
  onRadiusChange: propOnRadiusChange,
  onFilteredEventsChange: propOnFilteredEventsChange,
  onEventClick: propOnEventClick,
  onWindowDaysChange: propOnWindowDaysChange,
  isLoading = false,
  isRefetching = false
}: WebLayoutProps) {
  const { user } = useAuth();
  const [showAuthModal, setShowAuthModal] = React.useState(false);
  const authTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (user && user.emailVerified !== false) {
      setShowAuthModal(false);
      if (authTimerRef.current) clearTimeout(authTimerRef.current);
      return;
    }
    if (!user) {
      authTimerRef.current = setTimeout(() => setShowAuthModal(true), 15000);
      return () => { if (authTimerRef.current) clearTimeout(authTimerRef.current); };
    }
  }, [user]);

  const handleAuthClose = React.useCallback(() => {
    setShowAuthModal(false);
    if (!user) {
      authTimerRef.current = setTimeout(() => setShowAuthModal(true), 60000);
    }
  }, [user]);

  const handleAuthSuccess = React.useCallback(() => {
    setShowAuthModal(false);
    if (authTimerRef.current) clearTimeout(authTimerRef.current);
  }, []);

  const handleLoginClick = React.useCallback(() => {
    setShowAuthModal(true);
  }, []);

  const [searchQuery, setSearchQuery] = React.useState(propSearchQuery || "");
  const [radius, setRadius] = React.useState(propRadius || 20);
  const [filteredEvents, setFilteredEvents] = React.useState<ExtendedEvent[]>(propFilteredEvents || []);
  const [selectedCategories, setSelectedCategories] = React.useState<string[]>([]);
  // Gesynchroniseerde datum selectie state - geen default, toont alle events
  const [selectedDays, setSelectedDays] = React.useState<Date[]>([]);
  
  // Event filters state (tags, doelgroepen, thema's) - default 100 dagen
  // addDays(today, 99) = vandaag + 99 dagen = 100 dagen totaal
  const [eventFilters, setEventFilters] = React.useState<EventFilterState>({
    tagIds: [],
    audienceIds: [],
    themeIds: [],
    startDate: null,
    endDate: addDays(startOfDay(new Date()), 99)
  });
  
  // Filter sidebar open/close state
  const [isFilterSidebarOpen, setIsFilterSidebarOpen] = React.useState(false);

  // Bereken windowDays uit eventFilters en stuur naar parent voor API call
  React.useEffect(() => {
    if (!propOnWindowDaysChange) return;
    
    const today = startOfDay(new Date());
    
    // Als er geen einddatum is, haal alle events op (null = geen limiet)
    if (!eventFilters.endDate) {
      propOnWindowDaysChange(null);
      return;
    }
    
    // WindowDays is het aantal dagen vanaf vandaag tot de einddatum
    // De API haalt events op vanaf vandaag tot vandaag+windowDays
    const daysUntilEnd = differenceInDays(eventFilters.endDate, today);
    const windowDays = Math.max(1, daysUntilEnd + 1); // +1 om de einddatum zelf mee te nemen
    
    console.log('Event filters changed, new windowDays:', windowDays, 
      'startDate:', eventFilters.startDate, 'endDate:', eventFilters.endDate);
    propOnWindowDaysChange(windowDays);
  }, [eventFilters.startDate, eventFilters.endDate, propOnWindowDaysChange]);

  // Update state when props change
  React.useEffect(() => {
    if (propSearchQuery !== undefined) setSearchQuery(propSearchQuery);
  }, [propSearchQuery]);

  React.useEffect(() => {
    if (propRadius !== undefined) setRadius(propRadius);
  }, [propRadius]);

  React.useEffect(() => {
    if (propFilteredEvents) {
      let filtered = propFilteredEvents;
      const today = startOfDay(new Date());
      
      // CRITICAL: Client-side date filtering - filter events within the date range
      // This ensures the filter works even when events come from parent
      if (eventFilters.endDate) {
        const endOfRange = endOfDay(eventFilters.endDate);
        const startOfRange = eventFilters.startDate ? startOfDay(eventFilters.startDate) : today;
        
        filtered = filtered.filter(event => {
          if (!event.startTime) return false;
          const eventDate = new Date(event.startTime);
          return eventDate >= startOfRange && eventDate <= endOfRange;
        });
      }
      
      // Filter events based on selected categories
      if (selectedCategories.length > 0) {
        filtered = filtered.filter(event => 
          selectedCategories.includes(event.category)
        );
      }
      
      // Filter events based on tag filters
      if (eventFilters.tagIds.length > 0) {
        filtered = filtered.filter(event => 
          event.eventTagIds && event.eventTagIds.some(tagId => 
            eventFilters.tagIds.includes(tagId)
          )
        );
      }
      
      // Filter events based on audience filters
      if (eventFilters.audienceIds.length > 0) {
        filtered = filtered.filter(event => 
          event.targetAudienceIds && event.targetAudienceIds.some(audienceId => 
            eventFilters.audienceIds.includes(audienceId)
          )
        );
      }
      
      // Filter events based on theme filters
      if (eventFilters.themeIds.length > 0) {
        filtered = filtered.filter(event => 
          event.seasonalThemeIds && event.seasonalThemeIds.some(themeId => 
            eventFilters.themeIds.includes(themeId)
          )
        );
      }
      
      setFilteredEvents(filtered);
    }
  }, [propFilteredEvents, selectedCategories, eventFilters]);

  const handleSearch = React.useCallback((query: string) => {
    setSearchQuery(query);
    propOnSearch?.(query);
  }, [propOnSearch]);

  const handleRadiusChange = React.useCallback((value: number) => {
    setRadius(value);
    propOnRadiusChange?.(value);
  }, [propOnRadiusChange]);

  const handleFilteredEventsChange = React.useCallback((events: ExtendedEvent[]) => {
    setFilteredEvents(events);
    propOnFilteredEventsChange?.(events);
  }, [propOnFilteredEventsChange]);
  
  const handleCategoriesChange = React.useCallback((categories: string[]) => {
    setSelectedCategories(categories);
  }, []);
  
  const handleEventClick = React.useCallback((event: ExtendedEvent) => {
    propOnEventClick?.(event);
  }, [propOnEventClick]);

  // Desktop layout zonder sidebar - alles in de hoofdcontainer
  return (
    <div className="h-screen flex overflow-hidden">
      <div className="flex-1 flex flex-col relative w-full">
        {/* Header in een eigen fixed container */}
        <div className="sticky top-0 left-0 right-0 z-[100]">
          <Header 
            isMapView={true}
            toggleView={() => {}}
            onSearch={handleSearch}
            radius={radius}
            onRadiusChange={handleRadiusChange}
            onCategoriesChange={handleCategoriesChange}
            hideViewToggle={true}
            onEventClick={handleEventClick}
            eventFilters={eventFilters}
            onEventFiltersChange={setEventFilters}
            resultCount={filteredEvents.length}
            isFilterSidebarOpen={isFilterSidebarOpen}
            onFilterSidebarOpenChange={setIsFilterSidebarOpen}
            onLoginClick={handleLoginClick}
          />
        </div>
        
        {/* Content container - SplitView handles all layout internally */}
        <div className="flex-1 relative overflow-hidden" style={{ zIndex: 50 }}>
          {/* Initial loading overlay - shown only on first load */}
          {isLoading && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-[200]">
              <div className="flex flex-col items-center gap-4 p-8 bg-card rounded-xl shadow-lg border">
                <div className="relative flex items-center justify-center w-16 h-16">
                  <MapPin className="h-12 w-12 text-primary animate-bounce absolute" />
                  <Loader2 className="h-5 w-5 text-primary/70 animate-spin absolute" style={{ marginTop: '2px' }} />
                </div>
                <div className="text-center">
                  <h3 className="font-semibold text-lg">Events laden...</h3>
                  <p className="text-sm text-muted-foreground">We zoeken naar activiteiten in jouw buurt</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Subtle refetching indicator - shown during background updates */}
          {isRefetching && !isLoading && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[200] bg-primary/90 text-primary-foreground px-3 py-1.5 rounded-full text-sm flex items-center gap-2 shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Bijwerken...</span>
            </div>
          )}
          
          {children ? (
            <div className="h-full overflow-y-auto p-4 pb-20 max-w-screen-2xl mx-auto" style={{ position: 'relative', zIndex: 50 }}>
              {children}
            </div>
          ) : (
            <SplitView 
              searchQuery={searchQuery}
              filteredEvents={filteredEvents}
              onFilteredEventsChange={handleFilteredEventsChange}
              onEventClick={handleEventClick}
              selectedDays={selectedDays}
              onFilterSidebarOpen={() => setIsFilterSidebarOpen(true)}
            />
          )}
          
          {/* Non-blocking filter sidebar */}
          <FilterSidebar
            filters={eventFilters}
            onFiltersChange={setEventFilters}
            resultCount={filteredEvents.length}
            isOpen={isFilterSidebarOpen}
            onClose={() => setIsFilterSidebarOpen(false)}
          />
        </div>
      </div>
      <AuthModal
        isOpen={showAuthModal}
        onClose={handleAuthClose}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}

export default WebLayout;