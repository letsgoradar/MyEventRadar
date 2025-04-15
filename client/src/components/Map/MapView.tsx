import * as React from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { Event } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import L from "leaflet";
import { formatDistance } from "date-fns";
import { nl } from "date-fns/locale";
import { CategoryIcon, getCategoryColor } from "../CategoryIcon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, MapPin, Clock, Euro } from "lucide-react";
import "leaflet/dist/leaflet.css";
import "./map-styles.css";
import { useOutsideClick } from "@/hooks/use-outside-click";

// Fix voor Leaflet iconen in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

// Component om de kaart automatisch te centreren op gebruiker
function MapCenter({ lat, lng, shouldFlyTo = false }: { lat: number; lng: number; shouldFlyTo?: boolean }) {
  const map = useMap();
  
  React.useEffect(() => {
    if (lat && lng) {
      if (shouldFlyTo) {
        map.flyTo([lat, lng], 13);
      } else {
        map.setView([lat, lng], 13);
      }
    }
  }, [lat, lng, map, shouldFlyTo]);
  
  return null;
}

// Functie om categorie-specifieke markers te maken
function createEventIcon(category: string) {
  const color = getCategoryColor(category as any);
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; display: flex; justify-content: center; align-items: center; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

interface MapViewProps {
  searchQuery?: string;
  radius?: number;
  filteredEvents?: Event[];
}

export default function MapView({ searchQuery = "", radius = 10, filteredEvents }: MapViewProps) {
  // State voor locatie van gebruiker
  const [userLocation, setUserLocation] = React.useState<[number, number]>([51.7767, 5.5345]);
  const [eventsData, setEventsData] = React.useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = React.useState<Event | null>(null);
  const [mapStyle, setMapStyle] = React.useState<'default' | 'satellite' | 'dark' | 'minimal' | 'colorful'>('default');
  const [showLayerOptions, setShowLayerOptions] = React.useState(false);
  
  // Referentie naar de dropdown menu voor outside click handling
  const layerMenuRef = React.useRef<HTMLDivElement>(null);
  
  // Sluit de layer options als er buiten wordt geklikt
  useOutsideClick(layerMenuRef, () => {
    if (showLayerOptions) setShowLayerOptions(false);
  });
  
  // Als de gebruiker locatie gegeven is, haal deze op
  React.useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);
          console.log("Got user location:", latitude, longitude);
        },
        (error) => {
          console.error("Error getting location:", error);
        }
      );
    }
  }, []);
  
  // Als er filteredEvents zijn, gebruik die; anders fetch events op basis van locatie en radius
  const { data: fetchedEvents, isLoading } = useQuery<Event[]>({
    queryKey: ['/api/events/nearby', userLocation[0], userLocation[1], radius, searchQuery],
    enabled: !filteredEvents && userLocation[0] !== 0 && userLocation[1] !== 0,
  });
  
  // Update events data als filteredEvents of fetchedEvents wijzigen
  React.useEffect(() => {
    if (filteredEvents) {
      setEventsData(filteredEvents);
    } else if (fetchedEvents) {
      setEventsData(fetchedEvents);
    }
  }, [filteredEvents, fetchedEvents]);
  
  // Format events voor gebruik op de kaart
  const formattedEvents = React.useMemo(() => {
    return eventsData.map(event => ({
      id: event.id,
      title: event.title,
      coords: [Number(event.latitude), Number(event.longitude)] as [number, number],
      category: event.category,
      startTime: event.startTime,
      event
    }));
  }, [eventsData]);
  
  // Render de kaart
  return (
    <div className="h-full w-full relative">
      {/* Kaartstijl selector met dropdown */}
      <div className="absolute top-4 right-4 z-30">
        <div className="relative" ref={layerMenuRef}>
          <Button 
            size="sm" 
            variant="secondary"
            className="flex items-center justify-center p-1 shadow-md"
            title="Kaartstijlen"
            onClick={() => setShowLayerOptions(!showLayerOptions)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-layers">
              <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/>
              <path d="m22 12-8.6 3.91a2 2 0 0 1-1.74 0L3 12"/>
              <path d="m22 17-8.6 3.91a2 2 0 0 1-1.74 0L3 17"/>
            </svg>
          </Button>
          
          {showLayerOptions && (
            <div className="absolute top-full right-0 mt-2 bg-white rounded-md shadow-lg p-2">
              <div className="flex flex-col space-y-2">
                <Button 
                  size="sm" 
                  variant={mapStyle === 'default' ? "default" : "outline"}
                  onClick={() => {
                    setMapStyle('default');
                    setShowLayerOptions(false);
                  }}
                  className="text-xs px-3 py-1 h-auto"
                >
                  Normaal
                </Button>
                <Button 
                  size="sm" 
                  variant={mapStyle === 'minimal' ? "default" : "outline"}
                  onClick={() => {
                    setMapStyle('minimal');
                    setShowLayerOptions(false);
                  }}
                  className="text-xs px-3 py-1 h-auto"
                >
                  Licht
                </Button>
                <Button 
                  size="sm" 
                  variant={mapStyle === 'satellite' ? "default" : "outline"}
                  onClick={() => {
                    setMapStyle('satellite');
                    setShowLayerOptions(false);
                  }}
                  className="text-xs px-3 py-1 h-auto"
                >
                  Satelliet
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <MapContainer
        center={userLocation}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        zoomControl={true}
        className="z-10 map-container"
        attributionControl={false}
      >
        {/* Meerdere stijlkeuzes voor kaartlagen */}
        {mapStyle === 'default' && (
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
          />
        )}
        {mapStyle === 'satellite' && (
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        )}
        {mapStyle === 'dark' && (
          <TileLayer
            url="https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
          />
        )}
        {mapStyle === 'minimal' && (
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
          />
        )}
        {mapStyle === 'colorful' && (
          <TileLayer
            url="https://tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
          />
        )}
        
        {/* Marker voor gebruiker locatie */}
        <Marker 
          position={userLocation}
          icon={L.divIcon({
            className: 'custom-user-icon',
            html: `<div style="background-color: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);"></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          })}
        >
          <Popup>
            <div>
              <p className="font-medium">Uw locatie</p>
            </div>
          </Popup>
        </Marker>
        
        {/* Markers voor events */}
        {formattedEvents.map((event) => (
          <Marker 
            key={event.id}
            position={event.coords}
            icon={createEventIcon(event.category)}
            eventHandlers={{
              click: () => {
                setSelectedEvent(event.event);
              }
            }}
          >
            <Popup>
              <Card className="border-0 shadow-none">
                <CardHeader className="p-2 pb-0">
                  <CardTitle className="text-base">
                    {event.title}
                  </CardTitle>
                  <CardDescription className="flex items-center text-xs">
                    <MapPin className="h-3 w-3 mr-1" />
                    <span>{event.coords[0].toFixed(6)}, {event.coords[1].toFixed(6)}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-2">
                  <div className="flex items-center text-xs text-muted-foreground">
                    <CategoryIcon category={event.category as any} size={12} className="mr-1" />
                    <span>{event.category}</span>
                  </div>
                  <div className="flex items-center text-xs text-muted-foreground mt-1">
                    <Calendar className="h-3 w-3 mr-1" />
                    <span>
                      {formatDistance(new Date(event.startTime), new Date(), {
                        addSuffix: true,
                        locale: nl,
                      })}
                    </span>
                  </div>
                </CardContent>
                <CardFooter className="p-2 pt-0">
                  <Button asChild size="sm" className="w-full">
                    <Link href={`/app2/event/${event.id}`}>
                      Bekijk details
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            </Popup>
          </Marker>
        ))}
        
        {/* Component om kaart te centreren op gebruiker */}
        <MapCenter lat={userLocation[0]} lng={userLocation[1]} />
      </MapContainer>
      
      {/* Overlay voor geselecteerd event (optioneel) */}
      {selectedEvent && (
        <div className="absolute bottom-4 left-4 right-4 pointer-events-auto z-10">
          <Card className="shadow-lg">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-base">{selectedEvent.title}</CardTitle>
              <CardDescription className="flex items-center text-xs">
                <MapPin className="h-3 w-3 mr-1" />
                <span>{selectedEvent.address || 'Locatie onbekend'}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-1 pb-1">
              <div className="flex space-x-4 text-xs text-muted-foreground">
                <div className="flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  <span>
                    {new Date(selectedEvent.startTime).toLocaleDateString('nl-NL', { 
                      day: 'numeric', 
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                
                {selectedEvent.isPaid && (
                  <div className="flex items-center">
                    <Euro className="h-3 w-3 mr-1" />
                    <span>{Number(selectedEvent.price).toFixed(2)} EUR</span>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="p-3 pt-1 flex justify-between">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setSelectedEvent(null)}
              >
                Sluiten
              </Button>
              <Button asChild size="sm">
                <Link href={`/app2/event/${selectedEvent.id}`}>
                  Details
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}