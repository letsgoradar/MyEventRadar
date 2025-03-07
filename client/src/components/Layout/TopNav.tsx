import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Filter, Map, List, Calendar, X } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider"; 
import { DatePicker } from "@/components/ui/date-picker";
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
  const [showTimeFilter, setShowTimeFilter] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [timeRange, setTimeRange] = useState<number[]>([24]); // Default 24 hours
  const [temporaryTimeRange, setTemporaryTimeRange] = useState<number[]>([24]);
  const [temporaryDate, setTemporaryDate] = useState<Date>(new Date());
  const [activeFilters, setActiveFilters] = useState<{
    search?: string;
    timeToEvent?: { date: Date; hours: number };
  }>({});
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

  const { data: events = [], refetch } = useQuery<Event[]>({
    queryKey: ["/api/events/nearby", searchQuery, userLocation, selectedDate, timeRange],
    queryFn: async () => {
      if (!userLocation) return [];
      const params = new URLSearchParams({
        lat: userLocation.lat.toString(),
        lng: userLocation.lng.toString(),
        radius: "10",
        query: searchQuery,
        date: selectedDate.toISOString(),
        timeRange: timeRange[0].toString()
      });
      const response = await fetch(`/api/events/nearby?${params}`);
      if (!response.ok) throw new Error('Failed to fetch events');
      return response.json();
    },
    enabled: !!userLocation
  });

  // Effect to update filters when search changes
  useEffect(() => {
    const newFilters = { ...activeFilters };

    if (searchQuery) {
      newFilters.search = searchQuery;
    } else {
      delete newFilters.search;
    }

    setActiveFilters(newFilters);
    refetch();
  }, [searchQuery]);

  const applyTimeFilter = () => {
    setTimeRange(temporaryTimeRange);
    setSelectedDate(temporaryDate);
    const newFilters = { ...activeFilters };
    newFilters.timeToEvent = { date: temporaryDate, hours: temporaryTimeRange[0] };
    setActiveFilters(newFilters);
    refetch();
  };

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


  const formatTimeRange = (hours: number) => {
    if (hours < 24) return `${hours} uur`;
    if (hours === 24) return '1 dag';
    if (hours < 168) return `${Math.floor(hours / 24)} dagen`;
    if (hours === 168) return '1 week';
    if (hours < 720) return `${Math.floor(hours / 168)} weken`;
    return `${Math.floor(hours / 720)} maand${hours > 720 ? 'en' : ''}`;
  };

  const getStep = (value: number) => {
    if (value < 24) return 1; // Per hour
    if (value < 168) return 24; // Per day
    if (value < 720) return 168; // Per week
    return 720; // Per month
  };

  return (
    <>
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
              className="pl-4 w-full bg-blue-600/20 text-white placeholder:text-blue-100 border-blue-400 focus:border-blue-400 focus:ring-0 focus:outline-none"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (onSearch) {
                  onSearch(e.target.value);
                }
              }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            onClick={() => setShowTimeFilter(!showTimeFilter)} 
            variant="ghost" 
            size="icon" 
            className={`text-white hover:bg-blue-600 ${showTimeFilter ? 'bg-blue-600' : ''}`}
          >
            <Calendar className="h-5 w-5" />
          </Button>

          <Button 
            onClick={toggleView} 
            variant="ghost" 
            size="icon" 
            className="text-white hover:bg-blue-600"
          >
            {isMapView ? <List className="h-5 w-5" /> : <Map className="h-5 w-5" />}
          </Button>

          <Button 
            onClick={toggleFilterSheet} 
            variant="ghost" 
            size="icon" 
            className="text-white hover:bg-blue-600"
          >
            <Filter className="h-5 w-5" />
          </Button>
        </div>
      </nav>

      {/* Active Filters */}
      {(Object.keys(activeFilters).length > 0) && (
        <div className="fixed top-14 left-0 right-0 bg-white border-b z-30 py-2 px-4">
          <div className="flex flex-wrap gap-2 max-w-xl mx-auto">
            {activeFilters.search && (
              <div className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 rounded-full px-3 py-1 text-sm">
                <span>Zoekterm: {activeFilters.search} ({filteredAndSortedEvents.length} resultaten)</span>
                <button
                  onClick={() => setSearchQuery('')}
                  className="hover:text-blue-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            {activeFilters.timeToEvent && (
              <div className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 rounded-full px-3 py-1 text-sm">
                <span>
                  Tijd tot event: {formatTimeRange(activeFilters.timeToEvent.hours)}
                </span>
                <button
                  onClick={() => {
                    setShowTimeFilter(false);
                    const newFilters = { ...activeFilters };
                    delete newFilters.timeToEvent;
                    setActiveFilters(newFilters);
                    refetch();
                  }}
                  className="hover:text-blue-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Time-to-event filter */}
      {showTimeFilter && (
        <div className="fixed top-14 left-0 right-0 bg-white shadow-md z-40 p-4">
          <div className="flex items-center gap-4 max-w-xl mx-auto">
            <DatePicker
              date={temporaryDate}
              onSelect={setTemporaryDate}
              className="flex-shrink-0"
            />
            <div className="flex-1">
              <Slider
                value={temporaryTimeRange}
                onValueChange={setTemporaryTimeRange}
                max={720} // 1 month
                min={1}
                step={getStep(temporaryTimeRange[0])}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-gray-600 mt-1">
                <span>Tijd tot event: {formatTimeRange(temporaryTimeRange[0])}</span>
                <span>{filteredAndSortedEvents.length} resultaten</span>
              </div>
              <div className="mt-4 flex justify-end">
                <Button onClick={applyTimeFilter} className="bg-blue-600 text-white hover:bg-blue-700">
                  Filter toepassen
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}