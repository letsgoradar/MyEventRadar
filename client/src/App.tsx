import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Filter, MapPin, List, Calendar, Heart, User, Plus, X, SortAsc, ArrowUpDown } from "lucide-react"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Link, Route, Switch, useLocation } from "wouter"
import { CategoryPicker } from "@/components/CategoryPicker"
import Map from "@/components/Map"
import { EventList } from "@/components/Events/EventList"
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
  const today = new Date()
  const nextYear = addYears(today, 1)

  const [searchQuery, setSearchQuery] = React.useState('')
  const [category, setCategory] = React.useState('')
  const [fromDate, setFromDate] = React.useState<Date>(today)
  const [toDate, setToDate] = React.useState<Date>(nextYear)
  const [showFreeEvents, setShowFreeEvents] = React.useState(false)
  const [useDistanceFilter, setUseDistanceFilter] = React.useState(false)
  const [distanceRadius, setDistanceRadius] = React.useState(5) // Default 5km
  const [sortBy, setSortBy] = React.useState<'date' | 'distance'>('date')
  const [sortAscending, setSortAscending] = React.useState(true)
  const [viewMode, setViewMode] = React.useState<'map' | 'list'>('map')
  const [, setLocation] = useLocation()
  const [isFilterSheetOpen, setIsFilterSheetOpen] = React.useState(false)
  const [filtersEnabled, setFiltersEnabled] = React.useState(false)

  // Temporary states for filters before applying
  const [tempFilters, setTempFilters] = React.useState({
    searchQuery,
    category,
    fromDate: today,
    toDate: nextYear,
    showFreeEvents,
    useDistanceFilter,
    distanceRadius
  })

  const activeFilters = React.useMemo<ActiveFilter[]>(() => {
    if (!filtersEnabled) return [];

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
        label: `From: ${format(fromDate, 'MMM d, yyyy')}`
      });
    }
    if (toDate) {
      filters.push({
        key: 'toDate',
        value: toDate.toISOString(),
        label: `To: ${format(toDate, 'MMM d, yyyy')}`
      });
    }
    if (showFreeEvents) {
      filters.push({ key: 'free', value: 'true', label: 'Alleen gratis evenementen' });
    }
    if (useDistanceFilter) {
      filters.push({ key: 'distance', value: distanceRadius.toString(), label: `Within ${distanceRadius}km` });
    }

    return filters;
  }, [searchQuery, category, fromDate, toDate, showFreeEvents, useDistanceFilter, distanceRadius, filtersEnabled]);

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
        setFromDate(today);
        setTempFilters(prev => ({ ...prev, fromDate: today }));
        break;
      case 'toDate':
        setToDate(nextYear);
        setTempFilters(prev => ({ ...prev, toDate: nextYear }));
        break;
      case 'free':
        setShowFreeEvents(false);
        setTempFilters(prev => ({ ...prev, showFreeEvents: false }));
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
    setShowFreeEvents(tempFilters.showFreeEvents);
    setUseDistanceFilter(tempFilters.useDistanceFilter);
    setDistanceRadius(tempFilters.distanceRadius);
    setFiltersEnabled(true);
    setIsFilterSheetOpen(false);
  };

  const resetFilters = () => {
    setTempFilters({
      searchQuery: '',
      category: '',
      fromDate: today,
      toDate: nextYear,
      showFreeEvents: false,
      useDistanceFilter: false,
      distanceRadius: 5
    });
    setFiltersEnabled(false);
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
            {/* Top Navigation */}
            <nav className="bg-orange-500 p-4 flex justify-between items-center">
              <h1 className="text-white text-xl font-bold">EventMap</h1>
              <Link href="/create">
                <Button variant="secondary">Create Event</Button>
              </Link>
            </nav>

            {/* Filter Bar */}
            <div className="flex items-center gap-2 px-4 py-3 bg-white border-b relative z-30">
              <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <Filter className="h-5 w-5" />
                    {activeFilters.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-orange-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">
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
                    {/* Search */}
                    <div className="space-y-2">
                      <label htmlFor="search" className="text-sm font-medium">Search</label>
                      <Input
                        id="search"
                        placeholder="Search events..."
                        value={tempFilters.searchQuery}
                        onChange={(e) => setTempFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
                      />
                    </div>

                    {/* Distance Filter */}
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
                          Filter op afstand van mijn locatie
                        </label>
                      </div>

                      {tempFilters.useDistanceFilter && (
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Afstand (km): {tempFilters.distanceRadius}</label>
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

                    {/* Category */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Categorie</label>
                      <CategoryPicker
                        onCategoryChange={handleCategoryChange}
                      />
                    </div>

                    {/* Free Events Filter */}
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="free"
                        checked={tempFilters.showFreeEvents}
                        onCheckedChange={(checked) =>
                          setTempFilters(prev => ({ ...prev, showFreeEvents: checked as boolean }))
                        }
                      />
                      <label htmlFor="free" className="text-sm font-medium">Toon alleen gratis evenementen</label>
                    </div>

                    {/* Date Range */}
                    <div className="space-y-4">
                      <label className="text-sm font-medium">Datum bereik</label>
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

                    {/* Filter Buttons */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={resetFilters}
                      >
                        Reset Filters
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={applyFilters}
                      >
                        Filters Toepassen
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>

              {/* Active Filters Display */}
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

              {/* Sort Options (only visible in list view) */}
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

              {/* View Mode Toggle */}
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

            {/* Main Content */}
            <div className="flex-1 relative z-20">
              {viewMode === 'map' ? (
                <Map
                  filters={{
                    searchQuery,
                    category,
                    fromDate,
                    toDate,
                    showFreeEvents,
                    useDistanceFilter,
                    distanceRadius
                  }}
                  filtersEnabled={filtersEnabled}
                />
              ) : (
                <EventList
                  filters={{
                    searchQuery,
                    category,
                    fromDate,
                    toDate,
                    showFreeEvents,
                    useDistanceFilter,
                    distanceRadius
                  }}
                  filtersEnabled={filtersEnabled}
                  sortBy={sortBy}
                  sortAscending={sortAscending}
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