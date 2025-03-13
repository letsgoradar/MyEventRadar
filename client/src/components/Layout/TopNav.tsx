import React, { useState, useEffect, useRef } from 'react';
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
  radius?: number;
  onRadiusChange?: (value: number) => void;
}

export default function TopNav({ 
  isMapView, 
  toggleView, 
  toggleFilterSheet, 
  isFilterSheetOpen,
  setIsFilterSheetOpen,
  onSearch,
  radius = 10,
  onRadiusChange
}: TopNavProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [showTimeFilter, setShowTimeFilter] = useState(false);
  const [showRadiusSlider, setShowRadiusSlider] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [timeRange, setTimeRange] = useState<number[]>([168]); // Default 1 week (168 hours)
  const [customLocation, setCustomLocation] = useState<{lat: number, lng: number} | null>(null);
  const [activeFilters, setActiveFilters] = useState<{
    search?: string;
    timeToEvent?: { date: Date; hours: number };
  }>({});
  const [, setLocation] = useLocation();

  // Refs for clickaway handlers
  const timeFilterRef = useRef<HTMLDivElement>(null);
  const radiusSliderRef = useRef<HTMLDivElement>(null);
  const locationPickerRef = useRef<HTMLDivElement>(null);

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

  // Clickaway handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (timeFilterRef.current && !timeFilterRef.current.contains(event.target as Node)) {
        setShowTimeFilter(false);
      }
      if (radiusSliderRef.current && !radiusSliderRef.current.contains(event.target as Node)) {
        setShowRadiusSlider(false);
      }
      if (locationPickerRef.current && !locationPickerRef.current.contains(event.target as Node)) {
        setShowLocationPicker(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const { data: events = [], refetch } = useQuery({
    queryKey: ["/api/events/nearby", searchQuery, userLocation, selectedDate, timeRange, radius],
    queryFn: async () => {
      if (!userLocation) return [];
      const params = new URLSearchParams({
        lat: userLocation.lat.toString(),
        lng: userLocation.lng.toString(),
        radius: radius.toString(),
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

  // Effect to update filters and refetch when search or time filters change
  useEffect(() => {
    const newFilters = { ...activeFilters };

    if (searchQuery) {
      newFilters.search = searchQuery;
    } else {
      delete newFilters.search;
    }

    if (showTimeFilter) {
      newFilters.timeToEvent = { date: selectedDate, hours: timeRange[0] };
    } else {
      delete newFilters.timeToEvent;
    }

    setActiveFilters(newFilters);
    refetch();
  }, [searchQuery, selectedDate, timeRange[0], showTimeFilter, radius]);

  const filteredAndSortedEvents = events
    .filter(event => {
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        return (
          event.title?.toLowerCase().includes(searchLower) ||
          event.category?.toLowerCase().includes(searchLower) ||
          event.subcategory?.toLowerCase().includes(searchLower) ||
          event.description?.toLowerCase().includes(searchLower)
        );
      }
      return true;
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
    .filter(event => event.distance <= radius) // Filter events by radius
    .sort((a, b) => a.distance - b.distance);

  const handleViewResults = () => {
    if (filteredAndSortedEvents.length >= 2) {
      sessionStorage.setItem('currentSearch', searchQuery);
      sessionStorage.setItem('mapBounds', JSON.stringify({
        events: [
          { lat: Number(filteredAndSortedEvents[0].latitude), lng: Number(filteredAndSortedEvents[0].longitude) },
          { lat: Number(filteredAndSortedEvents[1].latitude), lng: Number(filteredAndSortedEvents[1].longitude) }
        ]
      }));
    }
    setShowResults(false);
  };

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
              className="pl-4 w-full bg-blue-600/20 text-white placeholder:text-blue-100 border-blue-400 focus:border-white focus:ring-0 focus:outline-none"
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
                    onClick={handleViewResults}
                    className="w-full p-2 text-left hover:bg-gray-100 text-blue-600 font-medium border-b"
                  >
                    <Map className="w-4 h-4 inline-block mr-2" />
                    Bekijk resultaten {isMapView ? 'op kaart' : 'in lijst'}
                  </button>
                )}
                {filteredAndSortedEvents.map((event) => (
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
                ))}
              </div>
            )}
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

      {/* Filter Summary */}
      <div className="fixed top-14 left-0 right-0 bg-white border-b z-30 py-2 px-4">
        <div className="max-w-xl mx-auto text-sm text-center">
          <button 
            onClick={() => setShowTimeFilter(true)} 
            className="inline-flex items-center px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 transition-colors"
          >
            Deze week
          </button>
          {" "}
          <span className="font-semibold">{filteredAndSortedEvents.length}</span>
          {" "}
          {searchQuery && (
            <>
              <button
                onClick={() => setSearchQuery('')}
                className="inline-flex items-center px-3 py-1 bg-blue-100 hover:bg-blue-200 rounded-full text-blue-700 transition-colors"
              >
                {searchQuery}
                <X className="h-3 w-3 ml-1"/>
              </button>
              {" "}
            </>
          )}
          events binnen
          {" "}
          <button 
            onClick={() => setShowRadiusSlider(!showRadiusSlider)} 
            className="inline-flex items-center px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 transition-colors"
          >
            {radius} km
          </button>
          {" "}
          van
          {" "}
          <button 
            onClick={() => setShowLocationPicker(!showLocationPicker)}
            className="inline-flex items-center px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 transition-colors"
          >
            mijn locatie
          </button>
        </div>
      </div>

      {/* Radius Slider */}
      {showRadiusSlider && (
        <div ref={radiusSliderRef} className="fixed top-[calc(3.5rem+2.5rem)] left-0 right-0 bg-white shadow-md z-40 p-4">
          <div className="flex items-center gap-4 max-w-xl mx-auto">
            <div className="flex-1">
              <Slider
                value={[radius]}
                onValueChange={(value) => {
                  const newRadius = value[0];
                  if (onRadiusChange) {
                    onRadiusChange(newRadius);
                  }
                }}
                max={50}
                min={1}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-gray-600 mt-1">
                <span>Radius: {radius} km</span>
                <span>{filteredAndSortedEvents.length} resultaten</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Time-to-event filter */}
      {showTimeFilter && (
        <div ref={timeFilterRef} className="fixed top-[calc(3.5rem+2.5rem)] left-0 right-0 bg-white shadow-md z-40 p-4">
          <div className="flex items-center gap-4 max-w-xl mx-auto">
            <DatePicker
              date={selectedDate}
              onSelect={setSelectedDate}
              className="flex-shrink-0"
            />
            <div className="flex-1">
              <Slider
                value={timeRange}
                onValueChange={setTimeRange}
                max={720}
                min={1}
                step={getStep(timeRange[0])}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-gray-600 mt-1">
                <span>Tijd tot event: {formatTimeRange(timeRange[0])}</span>
                <span>{filteredAndSortedEvents.length} resultaten</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Location Picker */}
      {showLocationPicker && (
        <div ref={locationPickerRef} className="fixed top-[calc(3.5rem+2.5rem)] left-0 right-0 bg-white shadow-md z-40 p-4">
          <div className="max-w-xl mx-auto">
            <div className="text-sm text-gray-600 mb-2">
              Kies een andere locatie:
            </div>
            {/* Here you would add a location picker component */}
            <div className="text-sm text-gray-500">
              Locatie picker functionaliteit komt binnenkort...
            </div>
          </div>
        </div>
      )}
    </>
  );
}