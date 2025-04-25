import * as React from "react"
import { SortAsc, Clock, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

interface SortMenuProps {
  sortBy: "time" | "distance";
  setSortBy: React.Dispatch<React.SetStateAction<"time" | "distance">>;
  className?: string;
}

export function SortMenu({ sortBy, setSortBy, className }: SortMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn("gap-1", className)}>
          <SortAsc className="h-4 w-4" />
          <span className="hidden sm:inline">Sorteren</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Sorteer op</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className={cn("cursor-pointer", sortBy === "time" && "font-semibold")}
          onClick={() => setSortBy("time")}
        >
          <Clock className="h-4 w-4 mr-2" />
          Tijd tot aanvang
        </DropdownMenuItem>
        <DropdownMenuItem
          className={cn("cursor-pointer", sortBy === "distance" && "font-semibold")}
          onClick={() => setSortBy("distance")}
        >
          <MapPin className="h-4 w-4 mr-2" />
          Afstand
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}