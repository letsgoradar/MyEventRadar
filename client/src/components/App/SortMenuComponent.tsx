import * as React from "react";
import { SortAsc, SortDesc, Clock, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Type voor sorteerrichting
export type SortDirection = "asc" | "desc";

// Props voor SortMenu component
interface SortMenuProps {
  sortDirection: SortDirection;
  setSortDirection: React.Dispatch<React.SetStateAction<SortDirection>>;
  className?: string;
  visible?: boolean;
}

// Functie om sorteerrichtingicon te bepalen
const getSortIcon = (direction: SortDirection) => {
  return direction === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
};

export function SortMenu({ 
  sortDirection, 
  setSortDirection, 
  className,
  visible = true 
}: SortMenuProps) {
  // Als de component niet zichtbaar moet zijn, toon deze niet
  if (!visible) return null;
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn("gap-1", className)}>
          {sortDirection === "asc" ? (
            <SortAsc className="h-4 w-4" />
          ) : (
            <SortDesc className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">Sorteren</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[200px]">
        <DropdownMenuLabel>Sorteeropties</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Sorteerveldsectie - alleen tijd beschikbaar */}
        <DropdownMenuItem
          className="cursor-pointer font-medium"
        >
          <Clock className="h-4 w-4 mr-2" />
          Sorteer op tijd tot aanvang
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        
        {/* Sorteerrichtingsectie */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <span className="font-medium">Volgorde</span>
            <span className="ml-auto text-xs text-muted-foreground flex items-center">
              {sortDirection === "asc" ? "Oplopend" : "Aflopend"} {getSortIcon(sortDirection)}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              <DropdownMenuItem
                className={cn("cursor-pointer", sortDirection === "asc" && "font-semibold")}
                onClick={() => setSortDirection("asc")}
              >
                <ArrowUp className="h-4 w-4 mr-2" />
                Oplopend
              </DropdownMenuItem>
              <DropdownMenuItem
                className={cn("cursor-pointer", sortDirection === "desc" && "font-semibold")}
                onClick={() => setSortDirection("desc")}
              >
                <ArrowDown className="h-4 w-4 mr-2" />
                Aflopend
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}