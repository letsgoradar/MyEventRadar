import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Filter, MapPin, List, Calendar, Heart, User, Plus, X, SortAsc, ArrowUpDown } from "lucide-react"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Link, Route, Switch, useLocation } from "wouter"
import { CategoryPicker } from "@/components/CategoryPicker"
import MapView from "@/components/Map/MapView"
import { EventList } from "@/components/EventList"
import CreateEventPage from "@/pages/create-event"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { format, addYears } from "date-fns"

const queryClient = new QueryClient()

interface ActiveFilter {
  key: string;
  value: string;
  label: string;
}

function App() {
  const [searchQuery, setSearchQuery] = React.useState('')
  const [category, setCategory] = React.useState('')
  const [fromDate, setFromDate] = React.useState<Date | null>(null)
  const [toDate, setToDate] = React.useState<Date | null>(null)
  const [showPaidEvents, setShowPaidEvents] = React.useState(false)
  const [useDistanceFilter, setUseDistanceFilter] = React.useState(false)
  const [distanceRadius, setDistanceRadius] = React.useState(5) 
  const [sortBy, setSortBy] = React.useState<'date' | 'distance'>('date')
  const [sortAscending, setSortAscending] = React.useState(true)
  const [viewMode, setViewMode] = React.useState<'map' | 'list'>('map')
  const [, setLocation] = useLocation()
  const [isFilterSheetOpen, setIsFilterSheetOpen] = React.useState(false)

  const [tempFilters, setTempFilters] = React.useState({
    searchQuery,
    category,
    fromDate: null,
    toDate: null,
    showPaidEvents,
    useDistanceFilter,
    distanceRadius
  })

  const activeFilters = React.useMemo<ActiveFilter[]>(() => {
    const filters: ActiveFilter[] = [];

    if (searchQuery) {
      filters.push({ key: 'search', value: searchQuery, label: `Search: ${searchQuery}` });
    }
    if (category) {
      filters.push({ key: 'category', value: category, label: `Category: ${category}` });
    }
    if (fromDate instanceof Date) {
      filters.push({
        key: 'fromDate',
        value: fromDate.toISOString(),
        label: `From: ${format(fromDate, 'MMM d, yyyy')}`
      });
    }
    if (toDate instanceof Date) {
      filters.push({
        key: 'toDate',
        value: toDate.toISOString(),
        label: `To: ${format(toDate, 'MMM d, yyyy')}`
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
        setTempFilters(prev => ({ ...prev, searchQuery: '' }));
        break;
      case 'category':
        setCategory('');
        setTempFilters(prev => ({ ...prev, category: '' }));
        break;
      case 'fromDate':
        setFromDate(null);
        setTempFilters(prev => ({ ...prev, fromDate: null }));
        break;
      case 'toDate':
        setToDate(null);
        setTempFilters(prev => ({ ...prev, toDate: null }));
        break;
      case 'paid':
        setShowPaidEvents(false);
        setTempFilters(prev => ({ ...prev, showPaidEvents: false }));
        break;
      case 'distance':
        setUseDistanceFilter(false);
        setTempFilters(prev => ({ ...prev, useDistanceFilter: false }));
        break;
    }
  };

  const handleCategoryChange = (main: string, sub: string) => {
    setTempFilters(prev => ({ ...prev, category: sub || main }));
  };

  const applyFilters = () => {
    setSearchQuery(tempFilters.searchQuery);
    setCategory(tempFilters.category);
    setFromDate(tempFilters.fromDate);
    setToDate(tempFilters.toDate);
    setShowPaidEvents(tempFilters.showPaidEvents);
    setUseDistanceFilter(tempFilters.useDistanceFilter);
    setDistanceRadius(tempFilters.distanceRadius);
    setIsFilterSheetOpen(false);
  };

  const toggleSort = () => {
    setSortAscending(!sortAscending);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <Switch>
        <Route path="/create">
          <CreateEventPage />
        </Route>
        <Route>
          <div className="flex flex-col h-screen">
            <nav className="bg-[#0066FF] p-4 flex justify-between items-center">
              <h1 className="text-white text-xl font-bold">EventMap</h1>
              <Link href="/create">
                <Button variant="secondary">Create Event</Button>
              </Link>
            </nav>

            <div className="flex items-center gap-2 px-4 py-3 bg-white border-b relative z-30">
              <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <Filter className="h-5 w-5" />
                    {activeFilters.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-[#FF6B00] text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">
                        {activeFilters.length}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-full overflow-y-auto z-50">
                  <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                  </SheetHeader>
                  <div className="grid gap-6 py-6">
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
                        value={tempFilters.searchQuery}
                        onChange={(e) => setTempFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Category</label>
                      <CategoryPicker
                        onCategoryChange={handleCategoryChange}
                      />
                    </div>

                    <div className="space-y-4">
                      <label className="text-sm font-medium">Date Range</label>
                      <div className="rounded-md border">
                        <CalendarComponent
                          mode="range"
                          selected={{
                            from: tempFilters.fromDate,
                            to: tempFilters.toDate
                          }}
                          onSelect={(range) => {
                            if (range?.from) {
                              setTempFilters(prev => ({
                                ...prev,
                                fromDate: range.from,
                                toDate: range.to || range.from
                              }));
                            }
                          }}
                          numberOfMonths={2}
                          className="rounded-md border"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="useDistance"
                          checked={tempFilters.useDistanceFilter}
                          onCheckedChange={(checked) =>
                            setTempFilters(prev => ({ ...prev, useDistanceFilter: checked as boolean }))
                          }
                        />
                        <label htmlFor="useDistance" className="text-sm font-medium">
                          Filter by distance from my location
                        </label>
                      </div>

                      {tempFilters.useDistanceFilter && (
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Distance (km): {tempFilters.distanceRadius}</label>
                          <Slider
                            min={1}
                            max={100}
                            step={1}
                            value={[tempFilters.distanceRadius]}
                            onValueChange={(value) => setTempFilters(prev => ({ ...prev, distanceRadius: value[0] }))}
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="paid"
                        checked={tempFilters.showPaidEvents}
                        onCheckedChange={(checked) =>
                          setTempFilters(prev => ({ ...prev, showPaidEvents: checked as boolean }))
                        }
                      />
                      <label htmlFor="paid" className="text-sm font-medium">Show paid events only</label>
                    </div>

                    <Button
                      className="w-full mt-4"
                      onClick={applyFilters}
                    >
                      Apply Filters
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>

              <div className="flex-1 flex gap-2 overflow-x-auto">
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

              {viewMode === 'list' && (
                <div className="flex items-center gap-2">
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
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleSort}
                    title={sortAscending ? "Sort Ascending" : "Sort Descending"}
                  >
                    <ArrowUpDown className="h-4 w-4" />
                  </Button>
                </div>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setViewMode(viewMode === 'map' ? 'list' : 'map')}
              >
                {viewMode === 'map' ? (
                  <List className="h-5 w-5" />
                ) : (
                  <MapPin className="h-5 w-5" />
                )}
              </Button>
            </div>

            <div className="flex-1 relative z-20">
              {viewMode === 'map' ? (
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
                  sortAscending={sortAscending}
                />
              )}
            </div>

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
  );
}

export default App;