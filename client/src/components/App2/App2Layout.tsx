import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, List, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import MapView from "@/components/Map/MapView";
import App2BottomNav from "./App2BottomNav";
import { Event } from "@shared/schema";
import { AnimatePresence, motion } from "framer-motion";

interface App2LayoutProps {
  children: React.ReactNode;
  title: string;
  showMap?: boolean;
  filteredEvents?: Event[];
  header?: React.ReactNode;
  isLoading?: boolean;
  searchQuery?: string;
  radius?: number;
  onSearch?: React.Dispatch<React.SetStateAction<string>>;
  onRadiusChange?: React.Dispatch<React.SetStateAction<number>>;
  onFilteredEventsChange?: React.Dispatch<React.SetStateAction<Event[]>>;
}

export function App2Layout({
  children,
  title,
  showMap = false,
  filteredEvents = [],
  header,
  isLoading = false,
  searchQuery,
  radius,
  onSearch,
  onRadiusChange,
  onFilteredEventsChange,
}: App2LayoutProps) {
  const [view, setView] = React.useState<"list" | "map">("list");
  const [mapExpanded, setMapExpanded] = React.useState<boolean>(false);
  
  // Geef voorkeur aan de kaartweergave als showMap=true
  React.useEffect(() => {
    if (showMap && view === "list") {
      setView("map");
    }
  }, [showMap]);
  
  // Functie om te schakelen tussen lijsten kaartweergave
  const toggleView = () => {
    setView(prev => prev === "list" ? "map" : "list");
  };
  
  // Functie om de kaart uit te vouwen of in te klappen
  const toggleMapExpanded = () => {
    setMapExpanded(prev => !prev);
  };
  
  // Bereken de hoogte van de kaart op basis van de expandedstatus
  const mapHeight = mapExpanded ? "h-[60vh]" : "h-[30vh]";
  
  // Maak de inhoud van de pagina op basis van de gekozen weergave
  return (
    <div className="flex flex-col min-h-screen bg-background pb-16">
      {/* Header met titel */}
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="container py-3">
          <h1 className="text-xl font-semibold">{title}</h1>
          {header}
        </div>
      </header>
      
      {/* Kaart/lijst-weergave knoppen */}
      <div className="container mt-2">
        <div className="flex space-x-2 mb-2">
          <Button
            variant={view === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("list")}
            className="flex-1"
          >
            <List className="h-4 w-4 mr-2" />
            Lijst
          </Button>
          <Button
            variant={view === "map" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("map")}
            className="flex-1"
          >
            <Map className="h-4 w-4 mr-2" />
            Kaart
          </Button>
        </div>
      </div>
      
      {/* Kaart weergave */}
      {view === "map" && (
        <div className="flex-1">
          <div className={cn("w-full transition-all", mapHeight)}>
            <MapView filteredEvents={filteredEvents} />
          </div>
          <div className="container">
            <Button
              variant="ghost"
              className="w-full flex items-center justify-center py-1"
              onClick={toggleMapExpanded}
            >
              {mapExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-2" />
                  Kaart verkleinen
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-2" />
                  Kaart vergroten
                </>
              )}
            </Button>
          </div>
        </div>
      )}
      
      {/* Lijst weergave - kinderen worden gerenderd */}
      <div className={cn("container pb-4", view === "map" && "pt-2")}>
        {view === "list" && 
          <div className="space-y-4">
            {children}
          </div>
        }
        {view === "map" && !mapExpanded && 
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        }
      </div>
      
      {/* Bottom navigation */}
      <App2BottomNav />
    </div>
  );
}