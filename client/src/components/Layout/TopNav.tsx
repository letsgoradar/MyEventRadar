import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Filter, Map, List, Plus } from "lucide-react";

interface TopNavProps {
  toggleFilterSheet?: () => void;
  isMapView?: boolean;
  toggleView?: () => void;
  isFilterSheetOpen: boolean;
  setIsFilterSheetOpen: (open: boolean) => void;
}

export default function TopNav({ 
  toggleFilterSheet, 
  isMapView, 
  toggleView,
  isFilterSheetOpen,
  setIsFilterSheetOpen
}: TopNavProps) {
  return (
    <div className="absolute top-0 left-0 right-0 z-50 h-[72px] bg-[#0097FB] text-white">
      <div className="flex items-center justify-between h-full px-4">
        <Link href="/">
          <h1 className="text-xl font-bold">Evenementen</h1>
        </Link>

        <div className="flex items-center gap-2">
          {toggleFilterSheet && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={toggleFilterSheet}
              className="text-white hover:bg-blue-500"
            >
              <Filter className="h-5 w-5" />
            </Button>
          )}

          {toggleView && isMapView !== undefined && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={toggleView}
              className="text-white hover:bg-blue-500"
            >
              {isMapView ? <List className="h-5 w-5" /> : <Map className="h-5 w-5" />}
            </Button>
          )}

          <Button asChild variant="ghost" className="text-white hover:bg-blue-500">
            <Link href="/create">
              <span className="flex items-center gap-1">
                <Plus className="h-5 w-5" />
                Aanmaken
              </span>
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}