import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Filter, MapPin, List, Calendar, Heart, User, Plus } from "lucide-react"
import { DateTimePicker } from "@/components/date-time-picker"
import { Link, useLocation } from "wouter"
import { CategoryPicker } from "@/components/CategoryPicker"
import Map from "@/components/Map"
import { EventList } from "@/components/EventList"

const queryClient = new QueryClient()

function App() {
  const [date, setDate] = React.useState<Date>()
  const [searchLocation, setSearchLocation] = React.useState('')
  const [radius, setRadius] = React.useState(5)
  const [viewMode, setViewMode] = React.useState<'map' | 'list'>('map')
  const [, setLocation] = useLocation()

  return (
    <QueryClientProvider client={queryClient}>
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
            <SheetContent side="top" className="w-full h-[50vh]">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <label>Location</label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Current location" 
                      value={searchLocation}
                      onChange={(e) => setSearchLocation(e.target.value)}
                    />
                    <Input 
                      type="number"
                      placeholder="Radius (km)"
                      value={radius}
                      onChange={(e) => setRadius(Number(e.target.value))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label>Date & Time</label>
                  <DateTimePicker date={date} setDate={setDate} />
                </div>
                <div className="space-y-2">
                  <label>Categories</label>
                  <CategoryPicker />
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
    </QueryClientProvider>
  )
}

export default App