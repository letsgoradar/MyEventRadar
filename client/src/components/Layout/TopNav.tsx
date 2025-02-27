import React from "react";
import { Button } from "@/components/ui/button";
import { MapPin, Menu, Plus } from "lucide-react";
import { Link } from "wouter";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CategoryPicker } from "@/components/CategoryPicker";

export default function TopNav() {
  return (
    <div className="bg-blue-600 px-4 py-3 flex justify-between items-center border-b sticky top-0 z-10">
      <div className="flex items-center">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-white">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-4 mt-4">
              <div>
                <h3 className="mb-2 font-medium">Categorieën</h3>
                <CategoryPicker />
              </div>
            </nav>
          </SheetContent>
        </Sheet>
        <div className="text-white font-semibold ml-2">Evenementen</div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="text-white">
          <MapPin className="h-5 w-5" />
        </Button>
        <Link href="/create">
          <Button size="sm" variant="secondary">
            <Plus className="h-4 w-4 mr-1" /> Aanmaken
          </Button>
        </Link>
      </div>
    </div>
  );
}