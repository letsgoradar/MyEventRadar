
import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Filter, MapPin } from "lucide-react"
import { DateTimePicker } from "@/components/date-time-picker"
import { Link } from "wouter"
import { CategoryPicker } from "@/components/CategoryPicker"
import Map from "@/components/Map"

const queryClient = new QueryClient()

function App() {
  const [date, setDate] = React.useState<Date>()
  const [location, setLocation] = React.useState('')
  const [radius, setRadius] = React.useState(5)
  
  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex flex-col h-screen">
        {/* Top Navigation */}
        <nav className="bg-orange-500 p-4 flex justify-between items-center">
          <h1 className="text-white text-xl font-bold">EventMap</h1>
          <Button variant="secondary">Create Event</Button>
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
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
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
        </div>

        {/* Main Content */}
        <div className="flex-1 relative">
          <Map />
        </div>

        {/* Bottom Navigation */}
        <nav className="bg-white border-t p-4">
          <div className="flex justify-around">
            <div className="flex flex-col items-center">
              <MapPin className="h-6 w-6" />
              <span className="text-sm">Map</span>
            </div>
          </div>
        </nav>
      </div>
    </QueryClientProvider>
  )
}

export default App
