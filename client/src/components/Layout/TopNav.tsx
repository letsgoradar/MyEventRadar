import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Filter, Map, List } from 'lucide-react';
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
  onSearch?: (query: string) => void;
}

export default function TopNav({ 
  isMapView, 
  toggleView, 
  toggleFilterSheet, 
  isFilterSheetOpen,
  setIsFilterSheetOpen,
  onSearch 
}: TopNavProps) {
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
      // Store search query
      sessionStorage.setItem('currentSearch', searchQuery);

      // Store bounds
      sessionStorage.setItem('mapBounds', JSON.stringify({
        events: [
          { lat: Number(filteredAndSortedEvents[0].latitude), lng: Number(filteredAndSortedEvents[0].longitude) },
          { lat: Number(filteredAndSortedEvents[1].latitude), lng: Number(filteredAndSortedEvents[1].longitude) }
        ]
      }));

      // Switch to map view if needed
      if (!isMapView && toggleView) {
        toggleView();
      }
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
              if (onSearch) {
                onSearch(e.target.value);
              }
            }}
            onFocus={() => setShowResults(true)}
            onBlur={() => {
              setTimeout(() => setShowResults(false), 200);
            }}
          />
          {showResults && searchQuery && (
            <div className="absolute w-full bg-white rounded-md shadow-lg mt-1 overflow-hidden z-[60]">
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
      </div>
    </nav>
  );
}