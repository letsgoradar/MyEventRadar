import * as React from "react";
import { Event } from "@shared/schema";
import Sidebar from "./Sidebar";
import Header from "./Header";
import SplitView from "./SplitView";
import { EventDetailPanel } from "./EventDetailPanel";

interface WebLayoutProps {
  children?: React.ReactNode;
  searchQuery?: string;
  radius?: number;
  filteredEvents?: Event[];
  onSearch?: (query: string) => void;
  onRadiusChange?: (radius: number) => void;
  onFilteredEventsChange?: (events: Event[]) => void;
  onEventClick?: (event: Event) => void;
}

export function WebLayout({ 
  children,
  searchQuery: propSearchQuery,
  radius: propRadius,
  filteredEvents: propFilteredEvents,
  onSearch: propOnSearch,
  onRadiusChange: propOnRadiusChange,
  onFilteredEventsChange: propOnFilteredEventsChange,
  onEventClick: propOnEventClick
}: WebLayoutProps) {
  // In de web-omgeving gebruiken we altijd de split view (geen toggle)
  const [searchQuery, setSearchQuery] = React.useState(propSearchQuery || "");
  const [radius, setRadius] = React.useState(propRadius || 10);
  const [filteredEvents, setFilteredEvents] = React.useState<Event[]>(propFilteredEvents || []);
  const [selectedCategories, setSelectedCategories] = React.useState<string[]>([]);
  const [selectedEvent, setSelectedEvent] = React.useState<Event | null>(null);

  // Update state when props change
  React.useEffect(() => {
    if (propSearchQuery !== undefined) setSearchQuery(propSearchQuery);
  }, [propSearchQuery]);

  React.useEffect(() => {
    if (propRadius !== undefined) setRadius(propRadius);
  }, [propRadius]);

  React.useEffect(() => {
    if (propFilteredEvents) {
      // Filter events based on selected categories
      if (selectedCategories.length > 0) {
        const filtered = propFilteredEvents.filter(event => 
          selectedCategories.includes(event.category)
        );
        setFilteredEvents(filtered);
      } else {
        setFilteredEvents(propFilteredEvents);
      }
    }
  }, [propFilteredEvents, selectedCategories]);

  const handleSearch = React.useCallback((query: string) => {
    setSearchQuery(query);
    propOnSearch?.(query);
  }, [propOnSearch]);

  const handleRadiusChange = React.useCallback((value: number) => {
    setRadius(value);
    propOnRadiusChange?.(value);
  }, [propOnRadiusChange]);

  const handleFilteredEventsChange = React.useCallback((events: Event[]) => {
    setFilteredEvents(events);
    propOnFilteredEventsChange?.(events);
  }, [propOnFilteredEventsChange]);
  
  const handleCategoriesChange = React.useCallback((categories: string[]) => {
    setSelectedCategories(categories);
  }, []);
  
  const handleEventClick = React.useCallback((event: Event) => {
    setSelectedEvent(event);
    propOnEventClick?.(event);
  }, [propOnEventClick]);

  const handleCloseEventDetail = React.useCallback(() => {
    setSelectedEvent(null);
  }, []);

  const handleNavigateEvent = React.useCallback((direction: 'previous' | 'next') => {
    if (!selectedEvent) return;
    
    const currentIndex = filteredEvents.findIndex(e => e.id === selectedEvent.id);
    if (direction === 'previous' && currentIndex > 0) {
      setSelectedEvent(filteredEvents[currentIndex - 1]);
    } else if (direction === 'next' && currentIndex < filteredEvents.length - 1) {
      setSelectedEvent(filteredEvents[currentIndex + 1]);
    }
  }, [selectedEvent, filteredEvents]);

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
          />
        </div>
        
        {/* Content container met side-by-side layout */}
        <div className="flex-1 flex overflow-hidden" style={{ zIndex: 50 }}>
          {/* Map/List View - Takes full width when no event selected, 60% when event selected */}
          <div className={`${selectedEvent ? 'w-3/5' : 'w-full'} transition-all duration-300`}>
            {children ? (
              <div className="h-full overflow-y-auto p-4 pb-20 max-w-screen-2xl mx-auto" style={{ position: 'relative', zIndex: 50 }}>
                {children}
              </div>
            ) : (
              <SplitView 
                searchQuery={searchQuery}
                radius={radius}
                filteredEvents={filteredEvents}
                onRadiusChange={handleRadiusChange}
                onFilteredEventsChange={handleFilteredEventsChange}
                onEventClick={handleEventClick}
              />
            )}
          </div>
          
          {/* Event Detail Panel - Shows when event is selected */}
          {selectedEvent && (
            <div className="w-2/5 border-l border-gray-200 bg-white">
              <EventDetailPanel
                event={selectedEvent}
                events={filteredEvents}
                onClose={handleCloseEventDetail}
                onPrevious={() => handleNavigateEvent('previous')}
                onNext={() => handleNavigateEvent('next')}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default WebLayout;