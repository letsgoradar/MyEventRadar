
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch } from 'wouter';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { MapPin, Filter, List, Map as MapIcon } from 'lucide-react';
import { DateTimePicker } from '@/components/date-time-picker';
import Map from '@/components/Map';
import EventList from '@/components/EventList';
import { CategoryPicker } from '@/components/CategoryPicker';

const queryClient = new QueryClient();

function App() {
  const [view, setView] = React.useState<'map' | 'list'>('map');
  const [location, setLocation] = React.useState('');
  const [radius, setRadius] = React.useState(5);
  
  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex flex-col h-screen">
        {/* Top Navigation */}
        <nav className="bg-orange-500 p-4 flex justify-between items-center">
          <h1 className="text-white text-xl font-bold">EventMap</h1>
          <Button variant="secondary">Create Event</Button>
        </nav>
        
        {/* View Toggle and Filter */}
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
                  <DateTimePicker />
                </div>
                <div className="space-y-2">
                  <label>Category</label>
                  <CategoryPicker />
                </div>
              </div>
            </SheetContent>
          </Sheet>
          
          <div className="flex gap-2">
            <Button
              variant={view === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setView('list')}
            >
              <List className="h-5 w-5" />
            </Button>
            <Button
              variant={view === 'map' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setView('map')}
            >
              <MapIcon className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 relative">
          {view === 'map' ? <Map /> : <EventList />}
        </div>
      </div>
    </QueryClientProvider>
  );
}

export default App;
