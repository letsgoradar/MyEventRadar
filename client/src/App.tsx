import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MapPin, Calendar as CalendarIcon, Heart, User } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Link, Route, Switch, useLocation } from "wouter"
import TopNav from "@/components/Layout/TopNav"
import { Toaster } from '@/components/ui/toaster'
import { CategoryPicker } from "@/components/CategoryPicker"
import MapView from "@/components/Map/MapView"
import EventList from "@/components/Events/EventList"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import CreateEventPage from "@/pages/create-event"
import MyEvents from '@/components/Events/MyEvents';
import FavoriteEvents from '@/components/Events/FavoriteEvents';
import EditEventPage from '@/pages/edit-event';


const queryClient = new QueryClient()

interface TempFilters {
  searchQuery: string;
  category: string;
  fromDate: Date | null;
  toDate: Date | null;
  showPaidEvents: boolean;
  useDistanceFilter: boolean;
  distanceRadius: number;
}

export default function App() {
  const [_, setLocation] = useLocation();
  const [isMapView, setIsMapView] = React.useState(true);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = React.useState(false);
  const [currentTab, setCurrentTab] = React.useState<'explore' | 'my-events' | 'favorites'>('explore');

  // Filter states
  const [searchQuery, setSearchQuery] = React.useState('');
  const [category, setCategory] = React.useState<string | null>(null);
  const [fromDate, setFromDate] = React.useState<Date | null>(null);
  const [toDate, setToDate] = React.useState<Date | null>(null);
  const [showPaidEvents, setShowPaidEvents] = React.useState(true);
  const [useDistanceFilter, setUseDistanceFilter] = React.useState(false);
  const [distanceRadius, setDistanceRadius] = React.useState(10);

  const toggleView = React.useCallback(() => {
    setIsMapView(prev => !prev);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="h-screen flex flex-col relative">
        <Switch>
          <Route path="/create">
            <CreateEventPage />
          </Route>
          <Route path="/edit-event/:eventId">
            {(params) => <EditEventPage />}
          </Route>
          <Route path="/">
            <>
              <TopNav 
                isMapView={isMapView}
                toggleView={toggleView}
                toggleFilterSheet={() => setIsFilterSheetOpen(true)}
                isFilterSheetOpen={isFilterSheetOpen}
                setIsFilterSheetOpen={setIsFilterSheetOpen}
              />

              <div className="absolute inset-0 top-[72px] bottom-[75px]">
                {isMapView ? (
                  <MapView
                    filters={{
                      searchQuery,
                      category,
                      fromDate,
                      toDate,
                      showPaidEvents,
                      useDistanceFilter,
                      distanceRadius
                    }}
                  />
                ) : (
                  <div className="h-full overflow-auto">
                    <EventList
                      filters={{
                        searchQuery,
                        category,
                        fromDate,
                        toDate,
                        showPaidEvents,
                        useDistanceFilter,
                        distanceRadius
                      }}
                      sortBy="date"
                      sortAscending={true}
                    />
                  </div>
                )}
              </div>

              <nav className="absolute bottom-0 left-0 right-0 h-[75px] bg-white border-t">
                <div className="flex justify-around h-full items-center">
                  <Link href="/">
                    <div className="flex flex-col items-center cursor-pointer">
                      <MapPin className="h-7 w-7" />
                      <span className="text-sm mt-1">Zoek</span>
                    </div>
                  </Link>
                  <Link href="/events">
                    <div className="flex flex-col items-center cursor-pointer">
                      <CalendarIcon className="h-7 w-7" />
                      <span className="text-sm mt-1">Mijn Events</span>
                    </div>
                  </Link>
                  <Link href="/favorites">
                    <div className="flex flex-col items-center cursor-pointer">
                      <Heart className="h-7 w-7" />
                      <span className="text-sm mt-1">Favorieten</span>
                    </div>
                  </Link>
                  <Link href="/profile">
                    <div className="flex flex-col items-center cursor-pointer">
                      <User className="h-7 w-7" />
                      <span className="text-sm mt-1">Profiel</span>
                    </div>
                  </Link>
                </div>
              </nav>
            </>
          </Route>
          <Route path="/events">
            <MyEvents />
          </Route>
          <Route path="/favorites">
            <FavoriteEvents />
          </Route>
        </Switch>

        <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
          <SheetContent side="left" className="w-full overflow-y-auto z-[9999]">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="grid gap-6 py-6">
              <div className="space-y-2">
                <label htmlFor="search" className="text-sm font-medium">Search</label>
                <Input
                  id="search"
                  value={tempFilters.searchQuery}
                  onChange={(e) => setTempFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
                  placeholder="Search events..."
                />
              </div>

              <div className="space-y-2">
                <CategoryPicker
                  value={tempFilters.category}
                  onValueChange={(value) => setTempFilters(prev => ({ ...prev, category: value }))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Date Range</label>
                <div className="grid gap-2">
                  <Calendar
                    mode="single"
                    selected={tempFilters.fromDate}
                    onSelect={(date) => setTempFilters(prev => ({ ...prev, fromDate: date }))}
                  />
                  <Calendar
                    mode="single"
                    selected={tempFilters.toDate}
                    onSelect={(date) => setTempFilters(prev => ({ ...prev, toDate: date }))}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="paid-events"
                  checked={tempFilters.showPaidEvents}
                  onCheckedChange={(checked) => 
                    setTempFilters(prev => ({ ...prev, showPaidEvents: checked as boolean }))
                  }
                />
                <label htmlFor="paid-events" className="text-sm font-medium">
                  Show paid events only
                </label>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="distance-filter"
                    checked={tempFilters.useDistanceFilter}
                    onCheckedChange={(checked) =>
                      setTempFilters(prev => ({ ...prev, useDistanceFilter: checked as boolean }))
                    }
                  />
                  <label htmlFor="distance-filter" className="text-sm font-medium">
                    Filter by distance
                  </label>
                </div>
                {tempFilters.useDistanceFilter && (
                  <div className="space-y-4">
                    <Slider
                      value={[tempFilters.distanceRadius]}
                      onValueChange={([value]) =>
                        setTempFilters(prev => ({ ...prev, distanceRadius: value }))
                      }
                      max={50}
                      step={1}
                    />
                    <div className="text-sm text-muted-foreground">
                      Within {tempFilters.distanceRadius} kilometers
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button onClick={() => {
                  setTempFilters({
                    searchQuery: "",
                    category: "",
                    fromDate: null,
                    toDate: null,
                    showPaidEvents: false,
                    useDistanceFilter: false,
                    distanceRadius: 5
                  });
                }} variant="outline" className="flex-1">
                  Reset
                </Button>
                <Button onClick={() => {
                  setSearchQuery(tempFilters.searchQuery);
                  setCategory(tempFilters.category);
                  setFromDate(tempFilters.fromDate);
                  setToDate(tempFilters.toDate);
                  setShowPaidEvents(tempFilters.showPaidEvents);
                  setUseDistanceFilter(tempFilters.useDistanceFilter);
                  setDistanceRadius(tempFilters.distanceRadius);
                  setIsFilterSheetOpen(false);
                }} className="flex-1">
                  Apply
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
        <Toaster />
      </div>
    </QueryClientProvider>
  );
}