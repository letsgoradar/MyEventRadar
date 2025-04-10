import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Event } from "@shared/schema";
import Sidebar from "./Sidebar";
import Header from "./Header";
import SplitView from "./SplitView";
import MapView from "@/components/Map/MapView";
import { EventList } from "@/components/EventList";
import BottomNav from "@/components/Layout/BottomNav";
import TopNav from "@/components/Layout/TopNav";

interface WebLayoutProps {
  children?: React.ReactNode;
  searchQuery?: string;
  radius?: number;
  filteredEvents?: Event[];
  onSearch?: (query: string) => void;
  onRadiusChange?: (radius: number) => void;
  onFilteredEventsChange?: (events: Event[]) => void;
}

export function WebLayout({ 
  children,
  searchQuery: propSearchQuery,
  radius: propRadius,
  filteredEvents: propFilteredEvents,
  onSearch: propOnSearch,
  onRadiusChange: propOnRadiusChange,
  onFilteredEventsChange: propOnFilteredEventsChange
}: WebLayoutProps) {
  const isMobile = useIsMobile();
  const [isMapView, setIsMapView] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState(propSearchQuery || "");
  const [radius, setRadius] = React.useState(propRadius || 10);
  const [filteredEvents, setFilteredEvents] = React.useState<Event[]>(propFilteredEvents || []);
  const [selectedCategories, setSelectedCategories] = React.useState<string[]>([]);

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

  const toggleView = React.useCallback(() => {
    setIsMapView(prev => !prev);
  }, []);

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

  // Mobile layout (reuses existing components)
  if (isMobile) {
    return (
      <div className="h-screen flex flex-col relative">
        <TopNav 
          isMapView={isMapView}
          toggleView={toggleView}
          onSearch={handleSearch}
          radius={radius}
          onRadiusChange={handleRadiusChange}
          onFilteredEventsChange={handleFilteredEventsChange}
        />
        <div className="absolute inset-0 top-[calc(3.5rem+3rem)] bottom-[75px] z-0">
          {isMapView ? (
            <MapView 
              searchQuery={searchQuery} 
              radius={radius} 
              filteredEvents={filteredEvents} 
            />
          ) : (
            <div className="h-full overflow-auto pt-4">
              <EventList 
                searchQuery={searchQuery} 
                radius={radius} 
                filteredEvents={filteredEvents} 
              />
            </div>
          )}
        </div>
        <BottomNav />
      </div>
    );
  }

  // Desktop layout (with sidebar and split view)
  return (
    <div className="h-screen flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header 
          isMapView={true} // Always true in web view since we're using SplitView
          toggleView={() => {}} // Empty function since we don't need this in web view
          onSearch={handleSearch}
          radius={radius}
          onRadiusChange={handleRadiusChange}
          onCategoriesChange={handleCategoriesChange}
          hideViewToggle={true} // Hide the toggle button in web view
        />
        <div className="flex-1">
          {children ? (
            <div className="h-full overflow-auto p-6">{children}</div>
          ) : (
            <SplitView 
              searchQuery={searchQuery}
              radius={radius}
              filteredEvents={filteredEvents}
              onRadiusChange={handleRadiusChange}
              onFilteredEventsChange={handleFilteredEventsChange}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default WebLayout;