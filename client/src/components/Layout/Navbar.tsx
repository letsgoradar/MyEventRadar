import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Search, Filter, Star } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Navbar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white">
      <div className="container flex items-center justify-between p-2">
        <div className="flex flex-1 justify-between">
          <Link href="/">
            <div className="flex flex-col items-center">
              <Search className="h-6 w-6" />
              <span className="text-xs">Search</span>
            </div>
          </Link>

          <Link href="/filters">
            <div className="flex flex-col items-center">
              <Filter className="h-6 w-6" />
              <span className="text-xs">Filters</span>
            </div>
          </Link>

          <Link href="/favorites">
            <div className="flex flex-col items-center">
              <Star className="h-6 w-6" />
              <span className="text-xs">Favorites</span>
            </div>
          </Link>
        </div>
      </div>
    </nav>
  );
}