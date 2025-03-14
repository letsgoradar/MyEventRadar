import { useState } from "react";
import { Map, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import MapView from "@/components/Map/MapView";
import EventList from "@/components/Events/EventList";

interface HomeProps {
  view: "map" | "list";
  setView: React.Dispatch<React.SetStateAction<"map" | "list">>;
}

export default function Home({ view, setView }: HomeProps) {
  const [location, setLocation] = useState({ lat: 52.3676, lng: 4.9041 }); // Default to Amsterdam
  const [radius, setRadius] = useState(2); // 2km default radius
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("");
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [showPaidEvents, setShowPaidEvents] = useState(false);
  const [useDistanceFilter, setUseDistanceFilter] = useState(true);
  const [filterSettings, setFilterSettings] = useState(null); //Added State for filter settings


  return (
    <div className="h-[calc(100vh-4rem)]">
      {view === "map" ? (
        <MapView 
          filters={{
            searchQuery,
            category,
            fromDate,
            toDate,
            showPaidEvents,
            useDistanceFilter,
            distanceRadius
          }}
        />
      ) : (
        <EventList 
          filters={{
            searchQuery,
            category,
            fromDate,
            toDate,
            showPaidEvents,
            useDistanceFilter,
            distanceRadius
          }}
          sortBy="date"
          sortAscending={true}
          categoryFilter={filterSettings?.category}
          subcategoryFilter={filterSettings?.subcategory}
        />
      )}
    </div>
  );
}