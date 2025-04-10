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
}

export function WebLayout({ children }: WebLayoutProps) {
  const isMobile = useIsMobile();
  const [isMapView, setIsMapView] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [radius, setRadius] = React.useState(10);
  const [filteredEvents, setFilteredEvents] = React.useState<Event[]>([]);

  const toggleView = React.useCallback(() => {
    setIsMapView(prev => !prev);
  }, []);

  const handleSearch = React.useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleRadiusChange = React.useCallback((value: number) => {
    setRadius(value);
  }, []);

  const handleFilteredEventsChange = React.useCallback((events: Event[]) => {
    setFilteredEvents(events);
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
          isMapView={isMapView}
          toggleView={toggleView}
          onSearch={handleSearch}
          radius={radius}
          onRadiusChange={handleRadiusChange}
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