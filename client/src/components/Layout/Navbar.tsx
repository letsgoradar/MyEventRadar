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

const RADIUS_OPTIONS = [
  { value: "0.5", label: "0.5 km" },
  { value: "1", label: "1 km" },
  { value: "2", label: "2 km" },
  { value: "5", label: "5 km" },
  { value: "10", label: "10 km" },
  { value: "15", label: "15 km" },
  { value: "30", label: "30 km" },
  { value: "50", label: "50 km" },
  { value: "100", label: "100 km" },
];

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 w-full bg-[hsl(24,95%,53%)] text-white">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link href="/">
            <a className="text-xl font-bold">EventMap</a>
          </Link>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <p className="text-sm">Current location</p>
              <Select defaultValue="2">
                <SelectTrigger className="w-[100px] bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder="Radius" />
                </SelectTrigger>
                <SelectContent>
                  {RADIUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button variant="ghost" size="icon">
              <Search className="h-5 w-5" />
            </Button>

            <Button variant="ghost" size="icon">
              <Filter className="h-5 w-5" />
            </Button>

            <Button variant="ghost" size="icon">
              <Star className="h-5 w-5" />
            </Button>

            <Button variant="secondary">Create Event</Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
