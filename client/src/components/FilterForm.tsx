import { 
  Tag as CategoryIcon,
  EuroSign,
  Clock,
  MapPin
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetDescription,
  SheetClose
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";

interface FilterFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onFilterChange: (filters: any) => void;
  currentFilters: any;
  eventCounts: Record<string, number>;
  mapZoomLevel?: number;
}

export function FilterForm({
  isOpen,
  onOpenChange,
  onFilterChange,
  currentFilters,
  eventCounts,
  mapZoomLevel
}: FilterFormProps) {
  // Calculate distance radius based on zoom level
  const getRadiusFromZoom = (zoom: number) => {
    // Example calculation: 20km at zoom 10, decreases by half for each zoom level
    return Math.round(20 * Math.pow(2, 10 - zoom));
  };

  const handleFilterChange = (updates: Partial<typeof currentFilters>) => {
    onFilterChange({
      ...currentFilters,
      ...updates
    });
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Filter Events</SheetTitle>
          <SheetDescription>
            {currentFilters.searchQuery && (
              <Badge variant="outline" className="mb-2">
                Search: {currentFilters.searchQuery}
              </Badge>
            )}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] pr-4">
          <div className="space-y-6 py-4">
            {/* Categories */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CategoryIcon className="h-4 w-4" />
                <h4 className="font-medium">Categories</h4>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(eventCounts)
                  .filter(([cat]) => cat !== 'all')
                  .map(([category, count]) => (
                    <button
                      key={category}
                      onClick={() => handleFilterChange({ category: currentFilters.category === category ? null : category })}
                      className={`flex items-center justify-between p-2 rounded-md text-sm ${
                        count === 0 ? 'opacity-50 cursor-not-allowed' : 
                        currentFilters.category === category ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}
                      disabled={count === 0}
                    >
                      <span className="capitalize">{category}</span>
                      <span className="text-xs">({count})</span>
                    </button>
                  ))
                }
              </div>
            </div>

            {/* Free/Paid Toggle */}
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <EuroSign className="h-4 w-4" />
                  <h4 className="font-medium">Price</h4>
                </div>
                <Switch
                  checked={currentFilters.showFreeOnly}
                  onCheckedChange={(checked) => handleFilterChange({ showFreeOnly: checked })}
                />
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {currentFilters.showFreeOnly ? 'Showing free events only' : 'Showing all events'}
              </p>
            </div>

            {/* Time to Event */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4" />
                <h4 className="font-medium">Time to Event</h4>
              </div>
              <div className="space-y-4">
                <Calendar
                  mode="single"
                  selected={currentFilters.selectedDate}
                  onSelect={(date) => date && handleFilterChange({ selectedDate: date })}
                  className="rounded-md border"
                />
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Within days:</span>
                    <span className="text-sm font-medium">{currentFilters.maxDaysToEvent}</span>
                  </div>
                  <Slider
                    value={[currentFilters.maxDaysToEvent]}
                    onValueChange={(values) => handleFilterChange({ maxDaysToEvent: values[0] })}
                    max={90}
                    step={1}
                  />
                </div>
              </div>
            </div>

            {/* Distance Filter (based on map zoom) */}
            {mapZoomLevel && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="h-4 w-4" />
                  <h4 className="font-medium">Distance</h4>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Search radius:</span>
                    <span className="text-sm font-medium">{getRadiusFromZoom(mapZoomLevel)}km</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Radius is automatically adjusted based on map zoom level
                  </p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 mt-4">
          <SheetClose asChild>
            <Button variant="outline" onClick={() => onFilterChange({})}>
              Reset All
            </Button>
          </SheetClose>
          <SheetClose asChild>
            <Button>Apply Filters</Button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}