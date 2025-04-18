import * as React from "react";
import { Button } from "@/components/ui/button";
import { SortAsc, Clock, MapPin } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface SortMenuProps {
  sortOrder: "time" | "distance";
  setSortOrder: (order: "time" | "distance") => void;
}

export function SortMenu({ sortOrder, setSortOrder }: SortMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <SortAsc className="h-4 w-4" />
          <span className="hidden sm:inline">Sorteren</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Sorteer op</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className={cn("cursor-pointer", sortOrder === "time" && "font-semibold")}
          onClick={() => setSortOrder("time")}
        >
          <Clock className="h-4 w-4 mr-2" />
          Tijd tot aanvang
        </DropdownMenuItem>
        <DropdownMenuItem
          className={cn("cursor-pointer", sortOrder === "distance" && "font-semibold")}
          onClick={() => setSortOrder("distance")}
        >
          <MapPin className="h-4 w-4 mr-2" />
          Afstand
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}