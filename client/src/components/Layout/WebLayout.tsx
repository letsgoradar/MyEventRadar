import React, { useState, useEffect } from 'react';
import TopNav from './TopNav';
import SideNav from './SideNav';
import SplitView from './SplitView';
import type { Event } from '@shared/schema';
import { useLocation } from 'wouter';

interface WebLayoutProps {
  children?: React.ReactNode;
}

export default function WebLayout({ children }: WebLayoutProps) {
  const [location] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [radius, setRadius] = useState(10);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  
  // Als we op een andere route dan de hoofdpagina zijn, toon dan de children content
  const isHomePage = location === '/';

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleRadiusChange = (value: number) => {
    setRadius(value);
  };

  const handleFilteredEventsChange = (events: Event[]) => {
    setFilteredEvents(events);
  };

  return (
    <div className="h-screen flex flex-col">
      <TopNav
        onSearch={handleSearch}
        radius={radius}
        onRadiusChange={handleRadiusChange}
        onFilteredEventsChange={handleFilteredEventsChange}
      />

      <div className="flex flex-1 overflow-hidden">
        <SideNav className="min-w-[240px] max-w-[300px] overflow-y-auto" />
        
        <main className="flex-1 overflow-hidden">
          {isHomePage ? (
            <SplitView
              searchQuery={searchQuery}
              radius={radius}
              filteredEvents={filteredEvents}
            />
          ) : (
            <div className="h-full overflow-auto p-4">
              {children}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}