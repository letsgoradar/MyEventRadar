import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
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

  const sortedEvents = events
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
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 5);

  return (
    <nav className="fixed top-0 w-full h-14 bg-[#0097FB] shadow-md z-10 flex items-center justify-between px-4">
      <div className="flex items-center">
        <Link href="/" className="flex items-center">
          <Logo className="w-8 h-8 text-white" />
          <span className="ml-2 text-white text-lg font-semibold">EventApp</span>
        </Link>
      </div>

      <div className="flex-1 mx-4 max-w-md relative">
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
          />
          {showResults && searchQuery && (
            <div className="absolute w-full bg-white rounded-md shadow-lg mt-1 overflow-hidden z-50">
              {sortedEvents.map((event) => (
                <Link key={event.id} href={`/event/${event.id}`}>
                  <div
                    className="p-2 hover:bg-gray-100 cursor-pointer"
                    onClick={() => setShowResults(false)}
                  >
                    <div className="font-medium">{event.title}</div>
                    <div className="text-sm text-gray-600">
                      {event.distance.toFixed(1)} km afstand
                    </div>
                  </div>
                </Link>
              ))}
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