import { useState } from "react";
import { Map, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import MapView from "@/components/Map/MapView";
import EventList from "@/components/Events/EventList";

export default function Home() {
  const [view, setView] = useState<"map" | "list">("map");
  const [location, setLocation] = useState({ lat: 52.3676, lng: 4.9041 }); // Default to Amsterdam
  const [radius, setRadius] = useState(2); // 2km default radius

  return (
    <div className="h-[calc(100vh-4rem)]">
      <div className="flex justify-end mb-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setView(view === "map" ? "list" : "map")}
        >
          {view === "map" ? (
            <List className="h-4 w-4" />
          ) : (
            <Map className="h-4 w-4" />
          )}
        </Button>
      </div>

      {view === "map" ? (
        <MapView />
      ) : (
        <EventList location={location} radius={radius} />
      )}
    </div>
  );
}
