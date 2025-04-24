import * as React from "react";
import { Link } from "wouter";
import { MdSearch, MdTune, MdMap, MdViewList, MdCalendarToday } from "react-icons/md";
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
import { CategoryIcon, getCategoryColor } from "@/components/CategoryIcon";
import { Check, Calendar, Search } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { 
  ToggleGroup, 
  ToggleGroupItem 
} from "@/components/ui/toggle-group";
import { Label } from "@/components/ui/label";
import { DateTimePicker } from "@/components/date-time-picker";
import { format, startOfWeek, endOfWeek, startOfDay, endOfDay, addDays } from "date-fns";
import { nl } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

interface HeaderProps {
  isMapView: boolean;
  toggleView: () => void;
  onSearch?: (query: string) => void;
  radius?: number;
  onRadiusChange?: (value: number) => void;
  onCategoriesChange?: (categories: string[]) => void;
  onDateRangeChange?: (dateRange: { start: Date; end?: Date }) => void;
  hideViewToggle?: boolean;
}

export function Header({
  isMapView,
  toggleView,
  onSearch,
  radius = 10,
  onRadiusChange,
  onCategoriesChange,
  onDateRangeChange,
  hideViewToggle = false,
}: HeaderProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategories, setSelectedCategories] = React.useState<string[]>([]);
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = React.useState(false);
  
  // Datumfilter opties
  const [dateFilterValue, setDateFilterValue] = React.useState<string>("deze-week");
  const [customDate, setCustomDate] = React.useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = React.useState<Date | undefined>(undefined);
  
  // Bereken de datumbereiken voor de verschillende filteropties
  const dateRanges = React.useMemo(() => {
    const now = new Date();
    return {
      "deze-week": {
        start: startOfWeek(now, { locale: nl, weekStartsOn: 1 }),
        end: endOfWeek(now, { locale: nl, weekStartsOn: 1 }),
      },
      "vandaag": {
        start: startOfDay(now),
        end: endOfDay(now),
      },
      "morgen": {
        start: startOfDay(addDays(now, 1)),
        end: endOfDay(addDays(now, 1)),
      },
      "specifieke-datum": {
        start: customDate || now,
        end: customEndDate,
      },
    };
  }, [customDate, customEndDate]);

  // Bij wijziging van de datumfilter, nieuwe datum doorgeven aan parent
  React.useEffect(() => {
    if (dateFilterValue && onDateRangeChange) {
      const range = dateRanges[dateFilterValue as keyof typeof dateRanges];
      if (range) {
        onDateRangeChange(range);
      }
    }
  }, [dateFilterValue, dateRanges, onDateRangeChange]);

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
  
  // Afhandelen van datumfilter wijziging
  const handleDateFilterChange = (value: string) => {
    setDateFilterValue(value);
  };
  
  // Haal de datum weergavetekst op basis van de geselecteerde optie
  const getDateDisplayText = () => {
    switch (dateFilterValue) {
      case "deze-week":
        return "Deze week";
      case "vandaag":
        return "Vandaag";
      case "morgen":
        return "Morgen";
      case "specifieke-datum":
        if (customDate) {
          return customEndDate 
            ? `${format(customDate, 'd MMM', { locale: nl })} - ${format(customEndDate, 'd MMM', { locale: nl })}`
            : format(customDate, 'd MMMM', { locale: nl });
        }
        return "Kies datum";
      default:
        return "Deze week";
    }
  };

  return (
    <div className="h-20 border-b border-border bg-background flex flex-col justify-center pointer-events-auto shadow-sm">
      {/* Zoek en datum container */}
      <div className="flex items-center px-4 justify-between w-full">
        {/* Logo en brandname */}
        <div className="w-32 md:w-48">
          <Link href="/?web=true" className="flex items-center gap-2">
            <div className="text-rose-500 font-semibold text-lg">evenementenvinder</div>
          </Link>
        </div>
        
        {/* Zoek en datumfilter */}
        <div className="flex items-center space-x-2 max-w-xl flex-1 justify-center">
          {/* Zoekbalk met afgeronde hoeken in een container met border */}
          <div className="relative">
            <div className="flex items-center border rounded-full overflow-hidden shadow-sm">
              <Input
                placeholder="Zoek evenementen"
                className="border-0 h-12 text-base rounded-l-full focus-visible:ring-0 focus-visible:ring-offset-0"
                value={searchQuery}
                onChange={handleSearchChange}
                onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit("")}
              />
              
              {/* Datum selector */}
              <div className="border-l h-full flex items-center px-4 bg-white">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="ghost" 
                      className="h-full rounded-none px-2 flex items-center gap-2 text-sm font-medium"
                    >
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{getDateDisplayText()}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="center">
                    <div className="p-2">
                      <div className="flex flex-col gap-1">
                        {["deze-week", "vandaag", "morgen"].map((option) => (
                          <Button 
                            key={option}
                            variant={dateFilterValue === option ? "default" : "ghost"}
                            size="sm"
                            className="justify-start"
                            onClick={() => setDateFilterValue(option)}
                          >
                            {option === "deze-week" && "Deze week"}
                            {option === "vandaag" && "Vandaag"}
                            {option === "morgen" && "Morgen"}
                            {dateFilterValue === option && (
                              <Check className="h-4 w-4 ml-auto" />
                            )}
                          </Button>
                        ))}
                        
                        <div className="my-1 border-t" />
                        
                        {/* Specifieke datum selectie */}
                        <div className="p-2">
                          <div className="space-y-2">
                            <Label>Specifieke datum</Label>
                            <DateTimePicker
                              date={customDate}
                              setDate={(date) => {
                                setCustomDate(date);
                                setDateFilterValue("specifieke-datum");
                              }}
                              mode="date"
                              placement="bottom"
                            />
                          </div>
                          <div className="space-y-2 mt-2">
                            <Label>Einddatum (optioneel)</Label>
                            <DateTimePicker
                              date={customEndDate}
                              setDate={setCustomEndDate}
                              mode="date"
                              placement="bottom"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              
              {/* Zoek button */}
              <Button 
                className="rounded-none rounded-r-full h-12 px-5 bg-rose-500 hover:bg-rose-600 text-white"
                onClick={() => handleSearchSubmit("")}
              >
                <Search className="h-5 w-5" />
              </Button>
            </div>
            
            {/* Zoekresultaten dropdown */}
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
        
        {/* Rechterkant met filters en gebruikersprofiel */}
        <div className="flex items-center gap-2">
          {/* Filters knop */}
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" className="rounded-full">
                <span>Filters</span>
                {selectedCategories.length > 0 && (
                  <span className="ml-1 bg-primary text-primary-foreground rounded-full h-5 w-5 flex items-center justify-center text-xs">
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
              className="h-10 w-10 rounded-full"
              title={isMapView ? "Lijstweergave" : "Kaartweergave"}
            >
              {isMapView ? (
                <MdViewList className="h-5 w-5" />
              ) : (
                <MdMap className="h-5 w-5" />
              )}
            </Button>
          )}
          
          {/* User profile */}
          <Link href="/web/profile" className="relative">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="h-10 w-10 rounded-full overflow-hidden border border-border hover:border-primary/50 transition-colors">
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
      
      {/* Categoriefilter balk */}
      <div className="px-4 py-2 border-t overflow-x-auto">
        <div className="flex items-center space-x-2 min-w-max">
          {CATEGORIES.map(category => (
            <Button 
              key={category}
              variant={selectedCategories.includes(category) ? "default" : "ghost"}
              size="sm"
              className={cn(
                "h-8 px-3 rounded-full text-xs",
                selectedCategories.includes(category) 
                  ? "bg-rose-500 hover:bg-rose-600 text-white"
                  : "hover:bg-gray-100"
              )}
              onClick={() => toggleCategory(category)}
            >
              <div className="flex items-center gap-1.5">
                <CategoryIcon category={category as any} size={14} className={selectedCategories.includes(category) ? "text-white" : ""} />
                <span>{category}</span>
              </div>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Header;