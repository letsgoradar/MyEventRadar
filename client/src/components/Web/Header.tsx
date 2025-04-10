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

interface HeaderProps {
  isMapView: boolean;
  toggleView: () => void;
  onSearch?: (query: string) => void;
  radius?: number;
  onRadiusChange?: (value: number) => void;
}

export function Header({
  isMapView,
  toggleView,
  onSearch,
  radius = 10,
  onRadiusChange,
}: HeaderProps) {
  const [searchQuery, setSearchQuery] = React.useState("");

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    onSearch?.(e.target.value);
  };

  const handleRadiusChange = (value: number[]) => {
    onRadiusChange?.(value[0]);
  };

  return (
    <div className="h-16 border-b border-border bg-background flex items-center px-4 justify-between">
      <div className="flex items-center gap-4 w-full max-w-md">
        <div className="relative flex-1">
          <MdSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
          <Input
            placeholder="Zoek evenementen..."
            className="pl-10"
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button size="icon" variant="outline">
              <MdTune className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-4">
              <h4 className="font-medium">Filters</h4>
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
          </PopoverContent>
        </Popover>

        <Button
          size="icon"
          variant="outline"
          onClick={toggleView}
          title={isMapView ? "Lijstweergave" : "Kaartweergave"}
        >
          {isMapView ? (
            <MdViewList className="h-5 w-5" />
          ) : (
            <MdMap className="h-5 w-5" />
          )}
        </Button>
      </div>

      <div className="hidden md:flex items-center gap-4">
        <Button variant="outline" asChild>
          <Link href="/login">Inloggen</Link>
        </Button>
        <Button asChild>
          <Link href="/create-event">Nieuw Evenement</Link>
        </Button>
      </div>
    </div>
  );
}

export default Header;