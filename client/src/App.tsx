import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Filter, Compass, List, Calendar, Heart, User, Plus, X, SortAsc, ArrowUpDown, Globe2, ChevronDown, ChevronUp } from "lucide-react"
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
import { format } from "date-fns"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTranslation } from "react-i18next"

const queryClient = new QueryClient()

const LANGUAGES = [
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' }
]

interface ActiveFilter {
  key: string;
  value: string;
  label: string;
}

function App() {
  const [isCategoryExpanded, setIsCategoryExpanded] = React.useState(false)
  const { t, i18n } = useTranslation()
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
            <nav className="bg-[#0066FF] p-4 flex justify-between items-center h-24">
              <h1 className="text-white text-xl font-bold">EventMap</h1>
              <div className="flex items-center gap-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-white">
                      <Globe2 className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {LANGUAGES.map((lang) => (
                      <DropdownMenuItem
                        key={lang.code}
                        onClick={() => i18n.changeLanguage(lang.code)}
                      >
                        <span className="mr-2">{lang.flag}</span>
                        {lang.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Link href="/create">
                  <Button variant="secondary">{t('events.create')}</Button>
                </Link>
              </div>
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
                  <SheetHeader className="flex items-center justify-between">
                    <SheetTitle>{t('events.category')}</SheetTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsCategoryExpanded(!isCategoryExpanded)}
                    >
                      {isCategoryExpanded ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </Button>
                  </SheetHeader>
                  {isCategoryExpanded && (
                    <div className="grid gap-6 py-6">
                      <div className="space-y-2">
                        <label htmlFor="search" className="text-sm font-medium">{t('events.search')}</label>
                        <Input
                          id="search"
                          placeholder={t('events.searchPlaceholder')}
                          value={tempFilters.searchQuery}
                          onChange={(e) => setTempFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t('events.category')}</label>
                        <CategoryPicker
                          onCategoryChange={handleCategoryChange}
                        />
                      </div>

                      <div className="space-y-4">
                        <label className="text-sm font-medium">{t('events.dateRange')}</label>
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
                          <label htmlFor="useDistance" className="text-sm font-medium">{t('events.filterDistance')}</label>
                        </div>

                        {tempFilters.useDistanceFilter && (
                          <div className="space-y-2">
                            <label className="text-sm font-medium">{t('events.distance', { distance: tempFilters.distanceRadius })}</label>
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
                        <label htmlFor="paid" className="text-sm font-medium">{t('events.showPaid')}</label>
                      </div>

                      <Button
                        className="w-full mt-4"
                        onClick={applyFilters}
                      >
                        {t('events.applyFilters')}
                      </Button>
                    </div>
                  )}
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
                      <SelectValue placeholder={t('events.sortBy')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date">{t('events.sortByDate')}</SelectItem>
                      <SelectItem value="distance">{t('events.sortByDistance')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleSort}
                    title={sortAscending ? t('events.sortAscending') : t('events.sortDescending')}
                  >
                    <ArrowUpDown className="h-4 w-4" />
                  </Button>
                </div>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setViewMode(viewMode === 'map' ? 'list' : 'map')}
                className="nav-icon-button"
              >
                {viewMode === 'map' ? (
                  <List className="nav-icon" />
                ) : (
                  <Compass className="nav-icon" />
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

            <nav className="bg-white border-t p-4 h-24">
              <div className="flex justify-around h-full items-center">
                <Link href="/">
                  <div className="flex flex-col items-center cursor-pointer">
                    <div className="nav-icon-button">
                      <Compass className="nav-icon" />
                    </div>
                    <span className="text-sm mt-1">{t('navigation.search')}</span>
                  </div>
                </Link>
                <Link href="/events">
                  <div className="flex flex-col items-center cursor-pointer">
                    <div className="nav-icon-button">
                      <Calendar className="nav-icon" />
                    </div>
                    <span className="text-sm mt-1">{t('navigation.events')}</span>
                  </div>
                </Link>
                <Link href="/create">
                  <div className="flex flex-col items-center cursor-pointer">
                    <div className="nav-icon-button">
                      <Plus className="nav-icon" />
                    </div>
                    <span className="text-sm mt-1">{t('navigation.create')}</span>
                  </div>
                </Link>
                <Link href="/favorites">
                  <div className="flex flex-col items-center cursor-pointer">
                    <div className="nav-icon-button">
                      <Heart className="nav-icon" />
                    </div>
                    <span className="text-sm mt-1">{t('navigation.favorites')}</span>
                  </div>
                </Link>
                <Link href="/profile">
                  <div className="flex flex-col items-center cursor-pointer">
                    <div className="nav-icon-button">
                      <User className="nav-icon" />
                    </div>
                    <span className="text-sm mt-1">{t('navigation.profile')}</span>
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