import * as React from "react";
import type { EventInterface } from "@shared/schema";
import Sidebar from "./Sidebar";
import Header from "./Header";
import SplitView from "./SplitView";
import { EventDetailPanel } from "./EventDetailPanel";
import { addDays, startOfDay, eachDayOfInterval, differenceInDays } from "date-fns";
import { type EventFilterState, FilterSidebar } from "@/components/Filters/EventFilters";
import { Loader2, MapPin } from "lucide-react";

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
  // In de web-omgeving gebruiken we altijd de split view (geen toggle)
  const [searchQuery, setSearchQuery] = React.useState(propSearchQuery || "");
  const [radius, setRadius] = React.useState(propRadius || 10);
  const [filteredEvents, setFilteredEvents] = React.useState<ExtendedEvent[]>(propFilteredEvents || []);
  const [selectedCategories, setSelectedCategories] = React.useState<string[]>([]);
  // Gesynchroniseerde datum selectie state - geen default, toont alle events
  const [selectedDays, setSelectedDays] = React.useState<Date[]>([]);
  
  // Event filters state (tags, doelgroepen, thema's) - geen default datum filter
  const [eventFilters, setEventFilters] = React.useState<EventFilterState>({
    tagIds: [],
    audienceIds: [],
    themeIds: [],
    startDate: null,
    endDate: null
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

  // Alleen desktop layout met sidebar en split view
  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col relative w-[calc(100vw-260px)]">
        {/* Header in een eigen fixed container */}
        <div className="sticky top-0 left-0 right-0 z-[100]">
          <Header 
            isMapView={true} // Always true in web view since we're using SplitView
            toggleView={() => {}} // Empty function since we don't need this in web view
            onSearch={handleSearch}
            radius={radius}
            onRadiusChange={handleRadiusChange}
            onCategoriesChange={handleCategoriesChange}
            hideViewToggle={true} // Hide the toggle button in web view
            onEventClick={handleEventClick}
            eventFilters={eventFilters}
            onEventFiltersChange={setEventFilters}
            resultCount={filteredEvents.length}
            isFilterSidebarOpen={isFilterSidebarOpen}
            onFilterSidebarOpenChange={setIsFilterSidebarOpen}
          />
        </div>
        
        {/* Content container - SplitView handles all layout internally */}
        <div className="flex-1 relative overflow-hidden" style={{ zIndex: 50 }}>
          {/* Initial loading overlay - shown only on first load */}
          {isLoading && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-[200]">
              <div className="flex flex-col items-center gap-4 p-8 bg-card rounded-xl shadow-lg border">
                <div className="relative">
                  <MapPin className="h-12 w-12 text-primary animate-bounce" />
                  <Loader2 className="h-6 w-6 text-primary animate-spin absolute -bottom-1 -right-1" />
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
    </div>
  );
}

export default WebLayout;