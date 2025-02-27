import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Search, Filter, Map, List, Plus } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

interface TopNavProps {
  activeFilters: { key: string; value: string; label: string; }[];
  isMapView: boolean;
  toggleView: () => void;
  isFilterSheetOpen: boolean;
  setIsFilterSheetOpen: (open: boolean) => void;
}

export default function TopNav({
  activeFilters,
  isMapView,
  toggleView,
  isFilterSheetOpen,
  setIsFilterSheetOpen
}: TopNavProps) {
  return (
    <header className="fixed top-0 left-0 right-0 h-[72px] bg-[#0097FB] text-white p-4 flex items-center justify-between z-40">
      <Link href="/">
        <h1 className="text-xl font-bold">Evenementen</h1>
      </Link>

      <div className="flex items-center gap-3">
        <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-white hover:bg-blue-600 relative">
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
            {/* Filter content */}
          </SheetContent>
        </Sheet>

        <Button 
          variant="ghost" 
          size="icon"
          onClick={toggleView}
          className="text-white hover:bg-blue-600"
        >
          {isMapView ? <List className="h-5 w-5" /> : <Map className="h-5 w-5" />}
        </Button>

        <Link href="/create">
          <Button className="bg-white text-[#0097FB] hover:bg-gray-100">
            <Plus className="h-4 w-4 mr-2" />
            Aanmaken
          </Button>
        </Link>
      </div>
    </header>
  );
}