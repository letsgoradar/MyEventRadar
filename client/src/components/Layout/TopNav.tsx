
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function TopNav() {
  const [, setLocation] = useLocation();
  
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-primary h-14 flex items-center px-4">
      <div className="container flex justify-between items-center">
        <div className="text-white font-bold text-lg">Byron</div>
        <Button 
          variant="secondary" 
          size="sm"
          onClick={() => setLocation("/create")}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Event
        </Button>
      </div>
    </nav>
  );
}
