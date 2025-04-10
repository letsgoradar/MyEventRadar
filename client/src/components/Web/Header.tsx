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
    <div className="h-20 border-b border-border bg-background flex items-center px-4 justify-between">
      <div className="flex items-center gap-4 w-full max-w-md">
        <div className="relative flex-1">
          <MdSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
          <Input
            placeholder="Zoek evenementen..."
            className="pl-10 h-11 text-base"
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button size="icon" variant="outline" className="h-11 w-11">
              <MdTune className="h-5 w-5" />
              {selectedCategories.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full h-5 w-5 flex items-center justify-center text-xs">
                  {selectedCategories.length}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[350px]" align="end">
            <div className="space-y-6">
              <div>
                <h4 className="font-medium mb-3">Filters</h4>
                <div className="space-y-2">
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
              
              <div className="space-y-2">
                <h4 className="font-medium">Categorieën</h4>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(category => (
                    <Button 
                      key={category}
                      variant={selectedCategories.includes(category) ? "default" : "outline"}
                      className="flex items-center gap-2"
                      size="sm"
                      onClick={() => toggleCategory(category)}
                    >
                      <CategoryIcon category={category as any} size={16} />
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
            className="h-11 w-11"
            title={isMapView ? "Lijstweergave" : "Kaartweergave"}
          >
            {isMapView ? (
              <MdViewList className="h-5 w-5" />
            ) : (
              <MdMap className="h-5 w-5" />
            )}
          </Button>
        )}
      </div>

      <div className="hidden md:flex items-center gap-4">
        <Button variant="outline" asChild>
          <Link href="/admin/login">Inloggen</Link>
        </Button>
        <Button asChild>
          <Link href="/web/create-event">Nieuw Evenement</Link>
        </Button>
      </div>
    </div>
  );
}

export default Header;