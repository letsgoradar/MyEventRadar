import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Menu, X, Filter, Plus, Map, List } from 'lucide-react';
import { Input } from "@/components/ui/input";
import Logo from '../ui/logo';
import { useQuery } from "@tanstack/react-query";
import type { Event } from "@shared/schema";
import { calculateDistance } from '@/lib/utils';

interface TopNavProps {
  isMapView?: boolean;
  toggleView?: () => void;
  toggleFilterSheet?: () => void;
  isFilterSheetOpen?: boolean;
  setIsFilterSheetOpen?: (open: boolean) => void;
}

const TopNav: React.FC<TopNavProps> = ({ 
  isMapView, 
  toggleView, 
  toggleFilterSheet, 
  isFilterSheetOpen,
  setIsFilterSheetOpen 
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        }
      );
    }
  }, []);

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ["/api/events/nearby", searchQuery, userLocation],
    queryFn: async () => {
      if (!userLocation) return [];
      const params = new URLSearchParams({
        lat: userLocation.lat.toString(),
        lng: userLocation.lng.toString(),
        radius: "10",
        query: searchQuery
      });
      const response = await fetch(`/api/events/nearby?${params}`);
      if (!response.ok) throw new Error('Failed to fetch events');
      return response.json();
    },
    enabled: !!userLocation && searchQuery.length > 0
  });

  // Filter and sort events based on search query and distance
  const filteredAndSortedEvents = events
    .filter(event => {
      const searchLower = searchQuery.toLowerCase();
      return (
        event.title?.toLowerCase().includes(searchLower) ||
        event.category?.toLowerCase().includes(searchLower) ||
        event.subcategory?.toLowerCase().includes(searchLower) ||
        event.description?.toLowerCase().includes(searchLower)
      );
    })
    .map(event => ({
      ...event,
      distance: userLocation 
        ? calculateDistance(
            userLocation.lat, 
            userLocation.lng, 
            Number(event.latitude), 
            Number(event.longitude)
          )
        : Infinity
    }))
    .sort((a, b) => a.distance - b.distance);

  const handleViewOnMap = () => {
    if (filteredAndSortedEvents.length >= 2) {
      // Calculate bounds for first two events
      const event1 = filteredAndSortedEvents[0];
      const event2 = filteredAndSortedEvents[1];

      // First store the search
      sessionStorage.setItem('currentSearch', searchQuery);

      // Then store bounds
      sessionStorage.setItem('mapBounds', JSON.stringify({
        events: [
          { lat: Number(event1.latitude), lng: Number(event1.longitude) },
          { lat: Number(event2.latitude), lng: Number(event2.longitude) }
        ]
      }));

      // Switch to map view if needed
      if (!isMapView && toggleView) {
        toggleView();
      }

      // Force a re-render of the map component by updating sessionStorage again
      setTimeout(() => {
        // Update storage again to trigger the map effect
        sessionStorage.setItem('mapBounds', JSON.stringify({
          events: [
            { lat: Number(event1.latitude), lng: Number(event1.longitude) },
            { lat: Number(event2.latitude), lng: Number(event2.longitude) }
          ]
        }));
      }, 100);
    }
    setShowResults(false);
  };

  return (
    <nav className="fixed top-0 w-full h-14 bg-[#0097FB] shadow-md z-50 flex items-center justify-between px-4">
      <div className="flex items-center">
        <Link href="/" className="flex items-center">
          <Logo className="w-8 h-8 text-white" />
        </Link>
      </div>

      <div className="flex-1 mx-4 max-w-xl relative">
        <div className="relative w-full">
          <Input
            type="text"
            placeholder="Zoeken..."
            className="pl-4 w-full bg-blue-600/20 text-white placeholder:text-blue-100 border-blue-400 focus:border-white"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowResults(true);
            }}
            onFocus={() => setShowResults(true)}
            onBlur={() => {
              // Delay hiding results to allow for clicking
              setTimeout(() => setShowResults(false), 200);
            }}
          />
          {showResults && searchQuery && (
            <div className="absolute w-full left-0 md:left-auto bg-white rounded-md shadow-lg mt-1 overflow-hidden z-[60] max-w-[100vw] md:max-w-full">
              {filteredAndSortedEvents.length > 0 && (
                <button
                  onClick={handleViewOnMap}
                  className="w-full p-2 text-left hover:bg-gray-100 text-blue-600 font-medium border-b"
                >
                  <Map className="w-4 h-4 inline-block mr-2" />
                  Bekijk {filteredAndSortedEvents.length} resultaten op kaart
                </button>
              )}
              {filteredAndSortedEvents.length > 0 ? (
                filteredAndSortedEvents.map((event) => (
                  <Link key={event.id} href={`/event/${event.id}`}>
                    <div
                      className="p-2 hover:bg-gray-100 cursor-pointer"
                      onClick={() => setShowResults(false)}
                    >
                      <div className="font-medium">{event.title}</div>
                      <div className="text-sm text-gray-600 flex justify-between">
                        <span>{event.category}</span>
                        <span>{event.distance.toFixed(1)} km</span>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="p-2 text-gray-500">Geen resultaten gevonden</div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button 
          onClick={toggleFilterSheet} 
          variant="ghost" 
          size="icon" 
          className="text-white hover:bg-blue-600"
        >
          <Filter className="h-5 w-5" />
        </Button>

        <Button 
          onClick={toggleView} 
          variant="ghost" 
          size="icon" 
          className="text-white hover:bg-blue-600"
        >
          {isMapView ? <List className="h-5 w-5" /> : <Map className="h-5 w-5" />}
        </Button>

        <Link href="/create-event">
          <Button variant="ghost" size="icon" className="text-white hover:bg-blue-600">
            <Plus className="h-5 w-5" />
          </Button>
        </Link>
      </div>
    </nav>
  );
};

export default TopNav;