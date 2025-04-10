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

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    onSearch?.(e.target.value);
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
    <div className="h-30 border-b border-border bg-background flex items-center px-6 justify-between z-20 relative">
      <div className="flex items-center gap-6 w-full max-w-lg">
        <div className="relative flex-1">
          <MdSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground h-6 w-6" />
          <Input
            placeholder="Zoek evenementen..."
            className="pl-12 h-14 text-base rounded-lg shadow-sm"
            value={searchQuery}
            onChange={handleSearchChange}
          />
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
              <div>
                <h4 className="font-medium mb-3 text-lg">Filters</h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Afstand</span>
                    <span className="text-sm text-muted-foreground">
                      {radius} km
                    </span>
                  </div>
                  <Slider
                    defaultValue={[radius]}
                    max={50}
                    step={1}
                    className="w-full"
                    onValueChange={handleRadiusChange}
                  />
                </div>
              </div>
              
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
        <Button variant="outline" asChild className="h-12 px-6 text-base">
          <Link href="/admin/login">Inloggen</Link>
        </Button>
        <Button asChild className="h-12 px-6 text-base">
          <Link href="/web/create-event">Nieuw Evenement</Link>
        </Button>
      </div>
    </div>
  );
}

export default Header;