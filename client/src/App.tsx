import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Filter, MapPin, List, Calendar, Heart, User, Plus, X } from "lucide-react"
import { DateTimePicker } from "@/components/date-time-picker"
import { Link, Route, Switch } from "wouter"
import { CategoryPicker } from "@/components/CategoryPicker"
import MapView from "@/components/Map/MapView"
import EventList from "@/components/Events/EventList"
import CreateEventPage from "@/pages/create-event"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"

const queryClient = new QueryClient()

interface ActiveFilter {
  key: string;
  value: string;
  label: string;
}

function App() {
  const [searchQuery, setSearchQuery] = React.useState('')
  const [category, setCategory] = React.useState('')
  const [startDate, setStartDate] = React.useState(new Date())
  const [showPaidEvents, setShowPaidEvents] = React.useState(false)
  const [viewMode, setViewMode] = React.useState<'map' | 'list'>('map')
  const [radius, setRadius] = React.useState(10)
  const [userLocation, setUserLocation] = React.useState({ lat: 51.9225, lng: 4.47917 }) // Default to Rotterdam

  React.useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        }
      );
    }
  }, []);

  const activeFilters = React.useMemo<ActiveFilter[]>(() => {
    const filters: ActiveFilter[] = [];

    if (searchQuery) {
      filters.push({ key: 'search', value: searchQuery, label: `Search: ${searchQuery}` });
    }
    if (category) {
      filters.push({ key: 'category', value: category, label: `Category: ${category}` });
    }
    if (startDate) {
      filters.push({
        key: 'date',
        value: startDate.toISOString(),
        label: `Date: ${startDate.toLocaleDateString()}`
      });
    }
    if (showPaidEvents) {
      filters.push({ key: 'paid', value: 'true', label: 'Paid Events Only' });
    }

    return filters;
  }, [searchQuery, category, startDate, showPaidEvents]);

  const removeFilter = (filterKey: string) => {
    switch (filterKey) {
      case 'search':
        setSearchQuery('');
        break;
      case 'category':
        setCategory('');
        break;
      case 'date':
        setStartDate(new Date());
        break;
      case 'paid':
        setShowPaidEvents(false);
        break;
    }
  };

  const handleCategoryChange = (main: string, sub: string) => {
    setCategory(sub || main);
  };

  const handleDateChange = (newDate: Date) => {
    setStartDate(newDate);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <Switch>
        <Route path="/create">
          <CreateEventPage />
        </Route>
        <Route>
          <div className="flex flex-col h-screen">
            {/* Top Navigation */}
            <nav className="bg-orange-500 p-4 flex justify-between items-center">
              <h1 className="text-white text-xl font-bold">EventMap</h1>
              <Link href="/create">
                <Button variant="secondary">Create Event</Button>
              </Link>
            </nav>

            {/* Filter Bar */}
            <div className="flex items-center gap-2 px-4 py-3 bg-white border-b relative z-40">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Filter className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <div className="fixed inset-0 z-50">
                  <SheetContent side="top" className="w-full overflow-y-auto">
                    <SheetHeader>
                      <SheetTitle>Filters</SheetTitle>
                    </SheetHeader>
                    <div className="grid gap-6 py-6">
                      {/* Active Filter Tags in Form */}
                      {activeFilters.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {activeFilters.map((filter) => (
                            <Badge
                              key={filter.key}
                              variant="secondary"
                              className="flex items-center gap-1"
                            >
                              {filter.label}
                              <button
                                onClick={() => removeFilter(filter.key)}
                                className="ml-1 hover:bg-gray-200 rounded-full p-0.5"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}

                      <div className="space-y-2">
                        <label htmlFor="search" className="text-sm font-medium">Search</label>
                        <Input
                          id="search"
                          placeholder="Search events..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Category</label>
                        <CategoryPicker
                          onCategoryChange={handleCategoryChange}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Date</label>
                          <DateTimePicker
                            date={startDate}
                            setDate={handleDateChange}
                            mode="date"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">Time</label>
                          <DateTimePicker
                            date={startDate}
                            setDate={handleDateChange}
                            mode="time"
                          />
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="paid"
                          checked={showPaidEvents}
                          onCheckedChange={(checked) =>
                            setShowPaidEvents(checked as boolean)
                          }
                        />
                        <label htmlFor="paid" className="text-sm font-medium">Show paid events</label>
                      </div>
                    </div>
                  </SheetContent>
                </div>
              </Sheet>

              {/* Active Filter Tags next to filter icon */}
              <div className="flex gap-2 flex-wrap overflow-x-auto">
                {activeFilters.map((filter) => (
                  <Badge
                    key={filter.key}
                    variant="secondary"
                    className="flex items-center gap-1 whitespace-nowrap"
                  >
                    {filter.label}
                    <button
                      onClick={() => removeFilter(filter.key)}
                      className="ml-1 hover:bg-gray-200 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>

              {/* View Mode Toggle */}
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto"
                onClick={() => setViewMode(viewMode === 'map' ? 'list' : 'map')}
              >
                {viewMode === 'map' ? (
                  <List className="h-5 w-5" />
                ) : (
                  <MapPin className="h-5 w-5" />
                )}
              </Button>
            </div>

            {/* Main Content */}
            <div className="flex-1 relative z-30">
              {viewMode === 'map' ? (
                <MapView filters={activeFilters} />
              ) : (
                <EventList
                  location={userLocation}
                  radius={radius}
                  filters={activeFilters}
                />
              )}
            </div>

            {/* Bottom Navigation */}
            <nav className="bg-white border-t p-4">
              <div className="flex justify-around">
                <Link href="/">
                  <div className="flex flex-col items-center cursor-pointer">
                    <MapPin className="h-6 w-6" />
                    <span className="text-sm">Explore</span>
                  </div>
                </Link>
                <Link href="/create">
                  <div className="flex flex-col items-center cursor-pointer">
                    <Plus className="h-6 w-6" />
                    <span className="text-sm">Create</span>
                  </div>
                </Link>
                <Link href="/favorites">
                  <div className="flex flex-col items-center cursor-pointer">
                    <Heart className="h-6 w-6" />
                    <span className="text-sm">Favorites</span>
                  </div>
                </Link>
                <Link href="/profile">
                  <div className="flex flex-col items-center cursor-pointer">
                    <User className="h-6 w-6" />
                    <span className="text-sm">Profile</span>
                  </div>
                </Link>
              </div>
            </nav>
          </div>
        </Route>
      </Switch>
    </QueryClientProvider>
  )
}

export default App