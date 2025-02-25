import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Filter, MapPin, List, Calendar, Heart, User, Plus, X, SortAsc } from "lucide-react"
import { DateTimePicker } from "@/components/date-time-picker"
import { Link, Route, Switch, useLocation } from "wouter"
import { CategoryPicker } from "@/components/CategoryPicker"
import Map from "@/components/Map"
import { EventList } from "@/components/EventList"
import CreateEventPage from "@/pages/create-event"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const queryClient = new QueryClient()

interface ActiveFilter {
  key: string;
  value: string;
  label: string;
}

function App() {
  const [searchQuery, setSearchQuery] = React.useState('')
  const [category, setCategory] = React.useState('')
  const [fromDate, setFromDate] = React.useState<Date>(new Date())
  const [toDate, setToDate] = React.useState<Date>(new Date())
  const [showPaidEvents, setShowPaidEvents] = React.useState(false)
  const [useDistanceFilter, setUseDistanceFilter] = React.useState(false)
  const [distanceRadius, setDistanceRadius] = React.useState(5) // Default 5km
  const [sortBy, setSortBy] = React.useState<'date' | 'distance'>('date')
  const [viewMode, setViewMode] = React.useState<'map' | 'list'>('map')
  const [, setLocation] = useLocation()

  const activeFilters = React.useMemo<ActiveFilter[]>(() => {
    const filters: ActiveFilter[] = [];

    if (searchQuery) {
      filters.push({ key: 'search', value: searchQuery, label: `Search: ${searchQuery}` });
    }
    if (category) {
      filters.push({ key: 'category', value: category, label: `Category: ${category}` });
    }
    if (fromDate) {
      filters.push({
        key: 'fromDate',
        value: fromDate.toISOString(),
        label: `From: ${fromDate.toLocaleDateString()}`
      });
    }
    if (toDate) {
      filters.push({
        key: 'toDate',
        value: toDate.toISOString(),
        label: `To: ${toDate.toLocaleDateString()}`
      });
    }
    if (showPaidEvents) {
      filters.push({ key: 'paid', value: 'true', label: 'Paid Events Only' });
    }
    if (useDistanceFilter) {
      filters.push({ key: 'distance', value: distanceRadius.toString(), label: `Within ${distanceRadius}km` });
    }

    return filters;
  }, [searchQuery, category, fromDate, toDate, showPaidEvents, useDistanceFilter, distanceRadius]);

  const removeFilter = (filterKey: string) => {
    switch (filterKey) {
      case 'search':
        setSearchQuery('');
        break;
      case 'category':
        setCategory('');
        break;
      case 'fromDate':
        setFromDate(new Date());
        break;
      case 'toDate':
        setToDate(new Date());
        break;
      case 'paid':
        setShowPaidEvents(false);
        break;
      case 'distance':
        setUseDistanceFilter(false);
        break;
    }
  };

  const handleCategoryChange = (main: string, sub: string) => {
    setCategory(sub || main);
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
            <div className="flex items-center gap-2 px-4 py-3 bg-white border-b relative z-30">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Filter className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="top" className="w-full overflow-y-auto z-50">
                  <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                  </SheetHeader>
                  <div className="grid gap-6 py-6">
                    {/* Active Filter Tags */}
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

                    {/* Search */}
                    <div className="space-y-2">
                      <label htmlFor="search" className="text-sm font-medium">Search</label>
                      <Input
                        id="search"
                        placeholder="Search events..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>

                    {/* Category */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Category</label>
                      <CategoryPicker
                        onCategoryChange={handleCategoryChange}
                      />
                    </div>

                    {/* Date Range */}
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">From Date</label>
                        <DateTimePicker
                          date={fromDate}
                          setDate={setFromDate}
                          mode="date"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">To Date</label>
                        <DateTimePicker
                          date={toDate}
                          setDate={setToDate}
                          mode="date"
                        />
                      </div>
                    </div>

                    {/* Distance Filter */}
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="useDistance"
                          checked={useDistanceFilter}
                          onCheckedChange={(checked) =>
                            setUseDistanceFilter(checked as boolean)
                          }
                        />
                        <label htmlFor="useDistance" className="text-sm font-medium">
                          Filter by distance from my location
                        </label>
                      </div>

                      {useDistanceFilter && (
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Distance (km): {distanceRadius}</label>
                          <Slider
                            min={1}
                            max={100}
                            step={1}
                            value={[distanceRadius]}
                            onValueChange={(value) => setDistanceRadius(value[0])}
                          />
                        </div>
                      )}
                    </div>

                    {/* Paid Events Filter */}
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="paid"
                        checked={showPaidEvents}
                        onCheckedChange={(checked) =>
                          setShowPaidEvents(checked as boolean)
                        }
                      />
                      <label htmlFor="paid" className="text-sm font-medium">Show paid events only</label>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>

              {/* Sort Options (only visible in list view) */}
              {viewMode === 'list' && (
                <Select value={sortBy} onValueChange={(value: 'date' | 'distance') => setSortBy(value)}>
                  <SelectTrigger className="w-[140px]">
                    <SortAsc className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Sort by..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Sort by Date</SelectItem>
                    <SelectItem value="distance">Sort by Distance</SelectItem>
                  </SelectContent>
                </Select>
              )}

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
            <div className="flex-1 relative z-20">
              {viewMode === 'map' ? (
                <Map 
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
                  sortBy={sortBy}
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
                <Link href="/events">
                  <div className="flex flex-col items-center cursor-pointer">
                    <Calendar className="h-6 w-6" />
                    <span className="text-sm">Events</span>
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