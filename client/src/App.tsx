import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MapPin, Calendar, Heart, User, Plus, PlusCircle, Menu } from "lucide-react"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Link, Route, Switch } from "wouter"
import { CategoryPicker } from "@/components/CategoryPicker"
import MapView from "@/components/Map/MapView"
import EventList from "@/components/Events/EventList"
import CreateEventPage from "@/pages/create-event"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import TopNav from "@/components/Layout/TopNav"

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

function App() {
  const [searchQuery, setSearchQuery] = React.useState('')
  const [category, setCategory] = React.useState('')
  const [fromDate, setFromDate] = React.useState<Date | null>(null)
  const [toDate, setToDate] = React.useState<Date | null>(null)
  const [showPaidEvents, setShowPaidEvents] = React.useState(false)
  const [useDistanceFilter, setUseDistanceFilter] = React.useState(false)
  const [distanceRadius, setDistanceRadius] = React.useState(5)
  const [isFilterSheetOpen, setIsFilterSheetOpen] = React.useState(false)
  const [isMapView, setIsMapView] = React.useState(true)

  const [tempFilters, setTempFilters] = React.useState<TempFilters>({
    searchQuery,
    category,
    fromDate: null,
    toDate: null,
    showPaidEvents,
    useDistanceFilter,
    distanceRadius
  })

  const activeFilters = React.useMemo(() => {
    const filters = [];

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

  const toggleView = React.useCallback(() => {
    setIsMapView(prev => !prev);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Switch>
        <Route path="/create">
          <CreateEventPage />
        </Route>
        <Route>
          <div className="flex flex-col h-screen">
            <TopNav 
              activeFilters={activeFilters}
              isMapView={isMapView}
              toggleView={toggleView}
              isFilterSheetOpen={isFilterSheetOpen}
              setIsFilterSheetOpen={setIsFilterSheetOpen}
            />

            <main className="flex-1 overflow-hidden"> {/* Adjusted main section */}
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
            </main>

            <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
              <SheetContent side="left" className="w-full overflow-y-auto z-50">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="grid gap-6 py-6">
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
                          from: tempFilters.fromDate || undefined,
                          to: tempFilters.toDate || undefined
                        }}
                        onSelect={(range) => {
                          setTempFilters(prev => ({
                            ...prev,
                            fromDate: range?.from || null,
                            toDate: range?.to || null
                          }));
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
          </div>
        </Route>
      </Switch>
    </QueryClientProvider>
  );
}