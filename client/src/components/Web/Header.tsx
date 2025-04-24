import * as React from "react";
import { Link } from "wouter";
import { MdSearch, MdTune, MdMap, MdViewList } from "react-icons/md";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { CATEGORIES } from "@shared/schema";
import { CategoryIcon } from "@/components/CategoryIcon";
import { Check } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface HeaderProps {
  isMapView: boolean;
  toggleView: () => void;
  onSearch?: (query: string) => void;
  radius?: number;
  onRadiusChange?: (value: number) => void;
  onCategoriesChange?: (categories: string[]) => void;
  hideViewToggle?: boolean;
}

export function Header({
  isMapView,
  toggleView,
  onSearch,
  radius = 10,
  onRadiusChange,
  onCategoriesChange,
  hideViewToggle = false,
}: HeaderProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategories, setSelectedCategories] = React.useState<string[]>([]);
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = React.useState(false);

  // Mock demo data for search results dropdown - in real implementation this would come from API
  React.useEffect(() => {
    if (searchQuery.trim() === "") {
      setSearchResults([]);
      return;
    }
    
    // Simulate search results based on query
    const demoResults = [
      { id: 1, title: `${searchQuery} Festival`, category: "Kunst en Cultuur" },
      { id: 2, title: `Workshop ${searchQuery}`, category: "Educatie" },
      { id: 3, title: `${searchQuery} Markt`, category: "Markten" },
    ];
    
    setSearchResults(demoResults);
  }, [searchQuery]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    setShowSearchResults(query.trim() !== "");
    // We don't call onSearch here immediately, only when a selection is made or search is executed
  };
  
  const handleSearchSubmit = (value: string) => {
    setShowSearchResults(false);
    onSearch?.(value || searchQuery);
  };

  const handleRadiusChange = (value: number[]) => {
    onRadiusChange?.(value[0]);
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => {
      const newCategories = prev.includes(category)
        ? prev.filter(cat => cat !== category)
        : [...prev, category];
        
      // Stuur de categoriewijziging door naar de parent
      onCategoriesChange?.(newCategories);
      return newCategories;
    });
  };

  return (
    <div className="h-20 border-b border-border bg-background flex items-center px-4 justify-between pointer-events-auto shadow-sm">
      <div className="flex items-center gap-4 w-full max-w-lg">
        <div className="relative flex-1">
          <MdSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5 z-10" />
          <div className="relative">
            <Input
              placeholder="Zoek evenementen..."
              className="pl-10 h-10 text-base rounded-md shadow-sm"
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit("")}
            />
            
            {/* Live zoekresultaten dropdown */}
            {showSearchResults && searchResults.length > 0 && (
              <Command className="absolute top-full left-0 right-0 mt-1 border shadow-md rounded-md overflow-hidden z-50 bg-white">
                <CommandList>
                  <CommandGroup>
                    <CommandItem 
                      onSelect={() => handleSearchSubmit("")}
                      className="p-2 cursor-pointer hover:bg-slate-100"
                    >
                      <div className="flex items-center gap-2">
                        <MdSearch className="text-muted-foreground" />
                        <span className="flex-1">
                          Zoek naar "<strong>{searchQuery}</strong>"
                        </span>
                      </div>
                    </CommandItem>
                  </CommandGroup>
                  
                  <CommandGroup heading="Evenementen">
                    {searchResults.map(result => (
                      <CommandItem 
                        key={result.id}
                        onSelect={() => handleSearchSubmit(result.title)}
                        className="p-2 cursor-pointer hover:bg-slate-100"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{result.title}</span>
                          <span className="text-sm text-muted-foreground">{result.category}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            )}
          </div>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button size="icon" variant="outline" className="h-14 w-14 rounded-lg">
              <MdTune className="h-6 w-6" />
              {selectedCategories.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full h-6 w-6 flex items-center justify-center text-xs">
                  {selectedCategories.length}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px]" align="end">
            <div className="space-y-6 p-2">
              {/* De afstandsfilter is verwijderd - dit wordt nu bepaald door in/uitzoomen op de kaart */}
              
              <div className="space-y-3">
                <h4 className="font-medium text-lg">Categorieën</h4>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(category => (
                    <Button 
                      key={category}
                      variant={selectedCategories.includes(category) ? "default" : "outline"}
                      className="flex items-center gap-2"
                      size="sm"
                      onClick={() => toggleCategory(category)}
                    >
                      <CategoryIcon category={category as any} size={18} />
                      <span className="text-sm">{category}</span>
                    </Button>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setSelectedCategories([]);
                    onCategoriesChange?.([]);
                  }}
                >
                  Filters wissen
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Toon de kaart/lijst schakelaar alleen indien niet verborgen */}
        {!hideViewToggle && (
          <Button
            size="icon"
            variant="outline"
            onClick={toggleView}
            className="h-14 w-14 rounded-lg"
            title={isMapView ? "Lijstweergave" : "Kaartweergave"}
          >
            {isMapView ? (
              <MdViewList className="h-6 w-6" />
            ) : (
              <MdMap className="h-6 w-6" />
            )}
          </Button>
        )}
      </div>

      <div className="hidden md:flex items-center gap-5">
        <Button asChild className="h-12 px-6 text-base">
          <Link href="/web/create-event">Nieuw Evenement</Link>
        </Button>
        
        <Link href="/web/profile" className="relative">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="h-12 w-12 rounded-full overflow-hidden border-2 border-primary/20 hover:border-primary/50 transition-colors">
                  <img 
                    src="/images/default-user.svg" 
                    alt="Profielfoto" 
                    className="h-full w-full object-cover"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Mijn Profiel</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </Link>
      </div>
    </div>
  );
}

export default Header;