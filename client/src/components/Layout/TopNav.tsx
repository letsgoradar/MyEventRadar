import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Map, List, X, ArrowUpDown } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import type { Event } from "@shared/schema";
import { compareAsc } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Logo from '../ui/logo';
import { calculateDistance } from '@/lib/utils';
import { addHours, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { DatePicker } from "@/components/ui/date-picker";
import { CATEGORIES } from '@shared/schema';

interface TopNavProps {
  isMapView?: boolean;
  toggleView?: () => void;
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
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [showTimeFilter, setShowTimeFilter] = useState(false);
  const [showRadiusSlider, setShowRadiusSlider] = useState(false);
  const [showPriceFilter, setShowPriceFilter] = useState(false);
  const [timeRange, setTimeRange] = useState<number[]>([168]); // Default 1 week (168 hours)
  const [priceRange, setPriceRange] = useState<number[]>([50]); // Default max price
  const [showOnlyFree, setShowOnlyFree] = useState(false);
  const [sortBy, setSortBy] = useState<'distance' | 'startTime'>('distance');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedCategory, setSelectedCategory] = useState<string>("all"); // "all" voor alle categorieën
  const [, setLocation] = useLocation();
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Get user location
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          console.error("Could not get user location");
          // Default to center of Netherlands
          setUserLocation({
            lat: 52.3676,
            lng: 4.9041,
          });
        }
      );
    }
  }, []);

  // Refs for clickaway handlers
  const timeFilterRef = useRef<HTMLDivElement>(null);
  const radiusSliderRef = useRef<HTMLDivElement>(null);
  const priceFilterRef = useRef<HTMLDivElement>(null);
  const searchResultsRef = useRef<HTMLDivElement>(null);

  // Clickaway handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (timeFilterRef.current && !timeFilterRef.current.contains(event.target as Node)) {
        setShowTimeFilter(false);
      }
      if (radiusSliderRef.current && !radiusSliderRef.current.contains(event.target as Node)) {
        setShowRadiusSlider(false);
      }
      if (priceFilterRef.current && !priceFilterRef.current.contains(event.target as Node)) {
        setShowPriceFilter(false);
      }
      if (searchResultsRef.current && !searchResultsRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ["/api/events/nearby", searchQuery, selectedDate, timeRange, radius, selectedCategory],
    queryFn: async () => {
      if (!userLocation) return [];
      const params = new URLSearchParams({
        lat: userLocation.lat.toString(),
        lng: userLocation.lng.toString(),
        radius: radius.toString(),
        query: searchQuery,
        date: selectedDate.toISOString(),
        timeRange: timeRange[0].toString(),
        category: selectedCategory === "all" ? "" : selectedCategory // Stuur lege string voor alle categorieën
      });
      const response = await fetch(`/api/events/nearby?${params}`);
      if (!response.ok) throw new Error('Failed to fetch events');
      return response.json();
    },
    enabled: !!userLocation
  });

  const sortedEvents = events
    .filter(event => {
      // Text search filter
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        return (
          event.title?.toLowerCase().includes(searchLower) ||
          event.category?.toLowerCase().includes(searchLower) ||
          event.description?.toLowerCase().includes(searchLower)
        );
      }
      return true;
    })
    .filter(event => {
      // Category filter
      if (selectedCategory !== "all") {
        return event.category === selectedCategory;
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
    .filter(event => {
      // Price filter
      if (showOnlyFree) return !event.isPaid;
      if (event.isPaid && event.price !== null) {
        return Number(event.price) <= priceRange[0];
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
    .filter(event => event.distance <= radius)
    .sort((a, b) => {
      if (sortBy === 'distance') {
        return a.distance - b.distance;
      } else {
        // Sort by start time
        return compareAsc(new Date(a.startTime), new Date(b.startTime));
      }
    });

  useEffect(() => {
    if (onFilteredEventsChange) {
      onFilteredEventsChange(sortedEvents);
    }
  }, [sortedEvents, onFilteredEventsChange]);

  return (
    <>
      <nav className="fixed top-0 w-full h-14 bg-[#0097FB] shadow-md z-50">
        <div className="flex items-center h-full px-4">
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <Logo className="w-8 h-8 text-white" />
            </Link>
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-3xl mx-4">
            <Input
              type="text"
              placeholder="Zoek evenement (voetballen, circus, tentoonstelling ...)"
              className="w-full bg-blue-600/20 text-white placeholder:text-blue-100 border-blue-400 focus:border-white focus:ring-0 focus:outline-none"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowResults(true);
                if (onSearch) onSearch(e.target.value);
              }}
              onFocus={() => setShowResults(true)}
            />
            {showResults && searchQuery && (
              <div ref={searchResultsRef} className="absolute w-full bg-white rounded-md shadow-lg mt-1 overflow-hidden z-[60] top-full">
                <button
                  onClick={() => {
                    setShowResults(false);
                    if (onSearch) onSearch(searchQuery);
                  }}
                  className="w-full p-2 text-left hover:bg-gray-100 text-blue-600 font-medium border-b"
                >
                  Bekijk {sortedEvents.length} resultaten
                </button>
                {sortedEvents.slice(0, 5).map((event) => (
                  <Link key={event.id} href={`/event/${event.id}`}>
                    <div
                      className="p-2 hover:bg-gray-100 cursor-pointer"
                      onClick={() => setShowResults(false)}
                    >
                      <div className="font-medium">{event.title}</div>
                      <div className="text-sm text-gray-600">
                        {event.category}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isMapView && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-blue-600"
                  >
                    <ArrowUpDown className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSortBy('distance')}>
                    Op afstand
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy('startTime')}>
                    Op startdatum/tijd
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button
              onClick={toggleView}
              variant="ghost"
              size="icon"
              className="text-white hover:bg-blue-600"
            >
              {isMapView ? <List className="h-5 w-5" /> : <Map className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </nav>

      {/* Filter Bar */}
      <div className="fixed top-14 left-0 right-0 bg-white border-b z-30">
        <div className="overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 p-2 px-4 whitespace-nowrap min-w-max">
            {/* Time Range Filter */}
            <button
              onClick={() => setShowTimeFilter(true)}
              className="inline-flex items-center px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 transition-colors"
            >
              Binnen {timeRange[0]} uur
            </button>

            {/* Category Filter */}
            <Select 
              value={selectedCategory} 
              onValueChange={setSelectedCategory}
            >
              <SelectTrigger className="inline-flex items-center px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 transition-colors border-0 h-auto">
                <SelectValue placeholder="Alle categorieën" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle categorieën</SelectItem>
                {CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Search Query Tag */}
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="inline-flex items-center px-3 py-1 bg-blue-100 hover:bg-blue-200 rounded-full text-blue-700 transition-colors"
              >
                {searchQuery}
                <X className="h-3 w-3 ml-1" />
              </button>
            )}

            {/* Category Tag */}
            {selectedCategory !== "all" && (
              <button
                onClick={() => setSelectedCategory("all")}
                className="inline-flex items-center px-3 py-1 bg-purple-100 hover:bg-purple-200 rounded-full text-purple-700 transition-colors"
              >
                {selectedCategory}
                <X className="h-3 w-3 ml-1" />
              </button>
            )}

            {/* Radius Filter */}
            <button
              onClick={() => setShowRadiusSlider(!showRadiusSlider)}
              className="inline-flex items-center px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 transition-colors"
            >
              {radius} km
            </button>

            {/* Price Filter */}
            <button
              onClick={() => setShowPriceFilter(!showPriceFilter)}
              className="inline-flex items-center px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 transition-colors"
            >
              {showOnlyFree ? 'Gratis' : `Tot €${priceRange[0]}`}
            </button>
          </div>
        </div>
      </div>

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
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-gray-600 mt-1">
                <span>Tijd tot event: {formatTimeRange(timeRange[0])}</span>
                <span>{sortedEvents.length} resultaten</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Radius Slider */}
      {showRadiusSlider && (
        <div ref={radiusSliderRef} className="fixed top-[calc(3.5rem+2.5rem)] left-0 right-0 bg-white shadow-md z-40 p-4">
          <div className="max-w-xl mx-auto">
            <Slider
              value={[radius]}
              onValueChange={(value) => {
                const newRadius = value[0];
                if (onRadiusChange) {
                  onRadiusChange(newRadius);
                }
              }}
              max={200}
              min={1}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-sm text-gray-600 mt-1">
              <span>Zoekgebied: {radius} km</span>
            </div>
          </div>
        </div>
      )}

      {/* Price Filter */}
      {showPriceFilter && (
        <div ref={priceFilterRef} className="fixed top-[calc(3.5rem+2.5rem)] left-0 right-0 bg-white shadow-md z-40 p-4">
          <div className="flex flex-col gap-4 max-w-xl mx-auto">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showOnlyFree}
                onChange={(e) => setShowOnlyFree(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">Alleen gratis evenementen</span>
            </div>
            {!showOnlyFree && (
              <div className="flex-1">
                <Slider
                  value={priceRange}
                  onValueChange={setPriceRange}
                  max={200}
                  min={0}
                  step={1}
                  className="w-full"
                  disabled={showOnlyFree}
                />
                <div className="flex justify-between text-sm text-gray-600 mt-1">
                  <span>Maximale prijs: €{priceRange[0]}</span>
                  <span>{sortedEvents.length} resultaten</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const formatTimeRange = (hours: number) => {
    if (hours < 24) return `${hours} uur`;
    if (hours === 24) return '1 dag';
    if (hours < 168) return `${Math.floor(hours / 24)} dagen`;
    if (hours === 168) return '1 week';
    if (hours < 720) return `${Math.floor(hours / 168)} weken`;
    return `${Math.floor(hours / 720)} maand${hours > 720 ? 'en' : ''}`;
  };