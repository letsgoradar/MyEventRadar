import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Filter, MapPin, List, Calendar, Heart, User, Plus } from "lucide-react"
import { DateTimePicker } from "@/components/date-time-picker"
import { Link, Route, Switch, useLocation } from "wouter"
import { CategoryPicker } from "@/components/CategoryPicker"
import Map from "@/components/Map"
import { EventList } from "@/components/EventList"
import CreateEventPage from "@/pages/create-event"
import { Checkbox } from "@/components/ui/checkbox"

const queryClient = new QueryClient()

function App() {
  const [date, setDate] = React.useState<Date>()
  const [searchLocation, setSearchLocation] = React.useState('')
  const [radius, setRadius] = React.useState(5)
  const [viewMode, setViewMode] = React.useState<'map' | 'list'>('map')
  const [, setLocation] = useLocation()
  const [searchQuery, setSearchQuery] = React.useState('')
  const [category, setCategory] = React.useState('')
  const [startDate, setStartDate] = React.useState(new Date())
  const [showPaidEvents, setShowPaidEvents] = React.useState(false)

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
            <div className="flex justify-between items-center px-4 py-3">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Filter className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="top" className="w-full max-h-[80vh] overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                  </SheetHeader>
                  <div className="grid gap-4 py-4">
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
                        onCategoryChange={(main, sub) => setCategory(sub || main)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Date</label>
                        <DateTimePicker
                          date={startDate}
                          setDate={setStartDate}
                          mode="date"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Time</label>
                        <DateTimePicker
                          date={startDate}
                          setDate={setStartDate}
                          mode="time"
                        />
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 pt-2">
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
              </Sheet>

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
            <div className="flex-1 relative">
              {viewMode === 'map' ? <Map /> : <EventList />}
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