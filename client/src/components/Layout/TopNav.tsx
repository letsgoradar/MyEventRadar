import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Map, List, X } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { DatePicker } from "@/components/ui/date-picker";
import Logo from '../ui/logo';
import { useQuery } from "@tanstack/react-query";
import type { Event } from "@shared/schema";
import { calculateDistance } from '@/lib/utils';
import { addHours, isWithinInterval, startOfDay, endOfDay } from 'date-fns';

interface TopNavProps {
  isMapView?: boolean;
  toggleView?: () => void;
  toggleFilterSheet?: () => void;
  isFilterSheetOpen?: boolean;
  setIsFilterSheetOpen?: (open: boolean) => void;
  onSearch?: (query: string) => void;
  radius?: number;
  onRadiusChange?: (value: number) => void;
  onFilteredEventsChange?: (events: Event[]) => void;
}

export default function TopNav({
  isMapView,
  toggleView,
  onSearch,
  radius = 10,
  onRadiusChange,
  onFilteredEventsChange
}: TopNavProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [showTimeFilter, setShowTimeFilter] = useState(false);
  const [showRadiusSlider, setShowRadiusSlider] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [timeRange, setTimeRange] = useState<number[]>([168]); // Default 1 week (168 hours)
  const [customLocation, setCustomLocation] = useState<{ lat: number, lng: number } | null>(null);
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
        },
        (error) => {
          console.error("Geolocation error:", error);
          setUserLocation({
            lat: 52.3676,
            lng: 4.9041
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

  const { data: events = [] } = useQuery<Event[]>({
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

  const filteredAndSortedEvents = events
    .filter(event => {
      // Text search filter
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
    .filter(event => {
      // Date and time range filter
      const eventDate = new Date(event.startTime);
      const rangeEnd = addHours(selectedDate, timeRange[0]);

      return isWithinInterval(eventDate, {
        start: startOfDay(selectedDate),
        end: endOfDay(rangeEnd)
      });
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
    .filter(event => event.distance <= radius)
    .sort((a, b) => a.distance - b.distance);

  useEffect(() => {
    if (onFilteredEventsChange) {
      onFilteredEventsChange(filteredAndSortedEvents);
    }
  }, [filteredAndSortedEvents, onFilteredEventsChange]);

  const formatTimeRange = (hours: number) => {
    if (hours < 24) return `${hours}u`;
    if (hours === 24) return '1d';
    if (hours < 168) return `${Math.floor(hours / 24)}d`;
    if (hours === 168) return '1w';
    if (hours < 720) return `${Math.floor(hours / 168)}w`;
    return `${Math.floor(hours / 720)}m`;
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

        <div className="flex items-center gap-2">
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

      {/* Filter bar */}
      <div className="fixed top-14 left-0 right-0 bg-white border-b z-30 py-2 px-4">
        <div className="max-w-xl mx-auto flex items-center gap-2 justify-center">
          <div className="bg-gray-50 rounded-full border border-gray-200 p-1 flex items-center gap-1">
            <button
              onClick={() => setShowTimeFilter(true)}
              className="px-3 py-1 rounded-full hover:bg-white transition-colors"
            >
              {formatTimeRange(timeRange[0])}
            </button>
            <button
              onClick={() => setShowRadiusSlider(!showRadiusSlider)}
              className="px-3 py-1 rounded-full hover:bg-white transition-colors"
            >
              {radius}km
            </button>
            <button
              onClick={() => setShowLocationPicker(!showLocationPicker)}
              className="px-3 py-1 rounded-full hover:bg-white transition-colors"
            >
              hier
            </button>
          </div>

          <span className="text-sm text-muted-foreground">
            {filteredAndSortedEvents.length} events
          </span>

          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="inline-flex items-center px-3 py-1 bg-blue-100 hover:bg-blue-200 rounded-full text-blue-700 transition-colors"
            >
              {searchQuery}
              <X className="h-3 w-3 ml-1" />
            </button>
          )}
        </div>
      </div>

      {/* Time filter popover */}
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
                <span>{formatTimeRange(timeRange[0])}</span>
                <span>{filteredAndSortedEvents.length} resultaten</span>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Location Picker */}
      {showLocationPicker && (
        <div ref={locationPickerRef} className="fixed top-[calc(3.5rem+2.5rem)] left-0 right-0 bg-white shadow-md z-40 p-4">
          <div className="max-w-xl mx-auto">
            <div className="text-sm text-gray-500">
              Locatie picker functionaliteit komt binnenkort...
            </div>
          </div>
        </div>
      )}
    </>
  );
}