import { useState } from "react";
import { Map, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import MapView from "@/components/Map/MapView";
import EventList from "@/components/Events/EventList";

// Constante voor heel Nederland radius
const NEDERLAND_RADIUS = 300;

interface HomeProps {
  view: "map" | "list";
  setView: React.Dispatch<React.SetStateAction<"map" | "list">>;
}

export default function Home({ view, setView }: HomeProps) {
  const [location, setLocation] = useState({ lat: 51.5719, lng: 5.0722 }); // Default to Noord-Brabant
  const [radius, setRadius] = useState(NEDERLAND_RADIUS); // Default naar heel Nederland
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  //Removed unnecessary state variables: category, showPaidEvents, useDistanceFilter

  return (
    <div className="h-[calc(100vh-4rem)]">
      {view === "map" ? (
        <MapView 
          searchQuery={searchQuery}
          radius={radius}
          onRadiusChange={setRadius}
          filteredEvents={[]}
        />
      ) : (
        <EventList 
          searchQuery={searchQuery}
          radius={radius}
          onRadiusChange={setRadius}
          fromDate={fromDate}
          toDate={toDate}
        />
      )}
    </div>
  );
}