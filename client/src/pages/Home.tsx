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
      {view === "map" ? (
        <MapView />
      ) : (
        <EventList />
      )}
    </div>
  );
}
