import * as React from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import type { EventInterface } from "@shared/schema";
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
import { getLocationName } from "@/utils/location-utils";

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

// Component om events bij te werken op basis van het huidige zoomniveau en grenzen
function MapEventLoader({ 
  onBoundsChange, 
  onZoomChange 
}: { 
  onBoundsChange: (bounds: L.LatLngBounds) => void; 
  onZoomChange: (zoom: number) => void;
}) {
  const map = useMap();
  
  // Gebruik refs om eerdere waarden te onthouden en onnodige updates te voorkomen
  const prevBoundsRef = React.useRef<L.LatLngBounds | null>(null);
  const prevZoomRef = React.useRef<number | null>(null);
  const onBoundsChangeRef = React.useRef(onBoundsChange);
  const onZoomChangeRef = React.useRef(onZoomChange);
  
  // Update refs wanneer callbacks veranderen (zonder hernieuwde registratie van event handlers)
  React.useEffect(() => {
    onBoundsChangeRef.current = onBoundsChange;
    onZoomChangeRef.current = onZoomChange;
  }, [onBoundsChange, onZoomChange]);
  
  // Initialiseer eventHandlers en stuur eerste waarden (slechts één keer bij mount)
  React.useEffect(() => {
    if (!map) return;
    
    // Hulpfunctie om bounds te vergelijken met een tolerantiedrempel
    const areBoundsDifferent = (a: L.LatLngBounds | null, b: L.LatLngBounds): boolean => {
      if (!a) return true;
      
      // Vergelijk de grenzen met een kleine tolerantie
      const nw1 = a.getNorthWest();
      const se1 = a.getSouthEast();
      const nw2 = b.getNorthWest();
      const se2 = b.getSouthEast();
      
      const tolerance = 0.001; // ongeveer 100m
      return (
        Math.abs(nw1.lat - nw2.lat) > tolerance ||
        Math.abs(nw1.lng - nw2.lng) > tolerance ||
        Math.abs(se1.lat - se2.lat) > tolerance ||
        Math.abs(se1.lng - se2.lng) > tolerance
      );
    };
    
    // Bij eerste render, stuur initiële waarden
    const sendInitialValues = () => {
      try {
        const currentBounds = map.getBounds();
        const currentZoom = map.getZoom();
        
        // Alleen versturen als de kaart volledig geladen is
        if (currentBounds && currentZoom) {
          // Update de refs
          prevBoundsRef.current = currentBounds;
          prevZoomRef.current = currentZoom;
          
          // Stuur initiële waarden
          onBoundsChangeRef.current(currentBounds);
          onZoomChangeRef.current(currentZoom);
          
          console.log("Initiële map bounds en zoom ingesteld");
        }
      } catch (err) {
        // Soms is de kaart nog niet volledig geladen
        console.log("Kaart nog niet volledig geladen, initiële waarden uitgesteld");
      }
    };
    
    // Geef de kaart even tijd om te laden
    const initTimer = setTimeout(sendInitialValues, 100);
    
    // Handler voor bewegingen van de kaart
    const handleMoveEnd = () => {
      try {
        const newBounds = map.getBounds();
        if (newBounds && areBoundsDifferent(prevBoundsRef.current, newBounds)) {
          onBoundsChangeRef.current(newBounds);
          prevBoundsRef.current = newBounds;
        }
      } catch (err) {
        console.error("Fout bij bounds update:", err);
      }
    };
    
    // Handler voor zoom acties
    const handleZoomEnd = () => {
      try {
        const newZoom = map.getZoom();
        const newBounds = map.getBounds();
        
        // Update zoom niveau als dat veranderd is
        if (newZoom !== undefined && newZoom !== prevZoomRef.current) {
          onZoomChangeRef.current(newZoom);
          prevZoomRef.current = newZoom;
        }
        
        // Update bounds na zoomen
        if (newBounds && areBoundsDifferent(prevBoundsRef.current, newBounds)) {
          onBoundsChangeRef.current(newBounds);
          prevBoundsRef.current = newBounds;
        }
      } catch (err) {
        console.error("Fout bij zoom update:", err);
      }
    };
    
    // Registreer event handlers
    map.on('moveend', handleMoveEnd);
    map.on('zoomend', handleZoomEnd);
    
    // Cleanup functie
    return () => {
      clearTimeout(initTimer);
      map.off('moveend', handleMoveEnd);
      map.off('zoomend', handleZoomEnd);
    };
  }, [map]); // Alleen afhankelijk van map, niet van callback functies
  
  return null;
}

// Functie om categorie-specifieke markers te maken - grotere en opvallender
function createEventIcon(category: string, isExpired: boolean = false, isSelected: boolean = false) {
  const color = isExpired ? "#9CA3AF" : getCategoryColor(category as any);
  const size = isSelected ? 24 : 20;
  const borderWidth = isSelected ? 3 : 2;
  const borderColor = isSelected ? "#ffffff" : "#ffffff";
  const innerSize = size - (borderWidth * 2);
  
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="
      width: ${size}px; 
      height: ${size}px; 
      border-radius: 50%; 
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      background-color: ${borderColor};
      display: flex;
      justify-content: center;
      align-items: center;
      transform-origin: center;
      ${isSelected ? 'transform: scale(1.2);' : ''}
      ${isSelected ? 'animation: pulse 1.5s infinite;' : ''}
    ">
      <div style="
        width: ${innerSize}px;
        height: ${innerSize}px;
        border-radius: 50%;
        background-color: ${color};
      "></div>
    </div>
    <style>
      @keyframes pulse {
        0% { transform: scale(1.1); }
        50% { transform: scale(1.3); }
        100% { transform: scale(1.1); }
      }
    </style>
    `,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
  });
}

interface MapViewProps {
  searchQuery?: string;
  radius?: number;
  filteredEvents?: EventInterface[];
  hideZoomControls?: boolean;
  onEventClick?: (event: EventInterface) => void;
  onRadiusChange?: (radius: number) => void;
  onBoundsChange?: (bounds: L.LatLngBounds) => void;
  onZoomChange?: (zoom: number) => void;
  showExpiredEvents?: boolean;
  onShowExpiredEventsChange?: (showExpired: boolean) => void;
}

export default function MapView({ 
  searchQuery = "", 
  radius = 10, 
  filteredEvents, 
  hideZoomControls = false,
  onEventClick,
  onRadiusChange: propOnRadiusChange,
  onBoundsChange: propOnBoundsChange,
  onZoomChange: propOnZoomChange,
  showExpiredEvents: propShowExpiredEvents,
  onShowExpiredEventsChange
}: MapViewProps) {
  // State voor locatie van gebruiker
  const [userLocation, setUserLocation] = React.useState<[number, number]>([51.7767, 5.5345]);
  const [eventsData, setEventsData] = React.useState<EventInterface[]>([]);
  const [selectedEvent, setSelectedEvent] = React.useState<EventInterface | null>(null);
  const [mapStyle, setMapStyle] = React.useState<'default' | 'satellite' | 'dark' | 'minimal' | 'colorful'>('default');
  const [showLayerOptions, setShowLayerOptions] = React.useState(false);
  const [currentBounds, setCurrentBounds] = React.useState<L.LatLngBounds | null>(null);
  const [currentZoom, setCurrentZoom] = React.useState<number>(13);
  const [showExpiredEvents, setShowExpiredEvents] = React.useState<boolean>(false);
  const [targetEvent, setTargetEvent] = React.useState<EventInterface | null>(null);
  
  // Referentie naar de MapContainer
  const mapRef = React.useRef<L.Map | null>(null);
  
  // Maak de map referentie globaal beschikbaar voor andere componenten
  React.useEffect(() => {
    // Maak mapRef globaal beschikbaar
    (window as any).mapRef = mapRef;
    
    return () => {
      // Cleanup bij unmount
      delete (window as any).mapRef;
    };
  }, []);
  
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
  
  // Houd de showExpiredEvents state gesynchroniseerd met de prop
  React.useEffect(() => {
    if (propShowExpiredEvents !== undefined) {
      setShowExpiredEvents(propShowExpiredEvents);
    }
  }, [propShowExpiredEvents]);
  
  // Als er filteredEvents zijn, gebruik die; anders fetch events op basis van locatie en radius
  const { data: fetchedEvents, isLoading, refetch } = useQuery<EventInterface[]>({
    queryKey: ['/api/events/nearby', userLocation[0], userLocation[1], radius, searchQuery],
    enabled: !filteredEvents && userLocation[0] !== 0 && userLocation[1] !== 0,
  });
  
  // Refetch events wanneer de kaartgrenzen significant zijn gewijzigd
  React.useEffect(() => {
    if (currentBounds && !filteredEvents) {
      refetch();
      
      // Als er een radius change handler is, stuur de nieuwe radius door
      if (propOnRadiusChange && currentZoom) {
        // Bereken een radius op basis van het huidige zoom niveau
        // Hoe verder uitgezoomd, hoe groter de radius
        const calculatedRadius = Math.max(5, Math.round(20 / (currentZoom * 0.4)));
        propOnRadiusChange(calculatedRadius);
      }
    }
  }, [currentBounds, refetch, filteredEvents, propOnRadiusChange, currentZoom]);
  
  // Update events data als filteredEvents of fetchedEvents wijzigen
  React.useEffect(() => {
    if (filteredEvents) {
      setEventsData(filteredEvents);
    } else if (fetchedEvents) {
      setEventsData(fetchedEvents);
    }
  }, [filteredEvents, fetchedEvents]);
  
  // Navigeer naar event (via props of direct aangeroepen vanuit zoekresultaten)
  const navigateToEvent = React.useCallback((event: EventInterface) => {
    // Stel het event als target in
    setTargetEvent(event);
    
    // Als de kaart beschikbaar is, navigeer ernaartoe
    if (mapRef.current && event.latitude && event.longitude) {
      const lat = Number(event.latitude);
      const lng = Number(event.longitude);
      
      // Hoger zoomniveau (17 in plaats van 16) voor nauwkeurigere locatie
      mapRef.current.flyTo([lat, lng], 17, {
        animate: true,
        duration: 1.5
      });
      
      // Markeer het event als geselecteerd zodat de popup kan worden getoond
      setSelectedEvent(event);
      
      // Sla de huidige zoekstatus op voor "terug naar zoekresultaten" functie
      // We slaan de huidige bounds, zoom en filter op
      const searchState = {
        bounds: currentBounds ? currentBounds.toBBoxString() : null,
        zoom: currentZoom,
        searchQuery,
        timestamp: new Date().getTime()
      };
      
      // Sla op in localStorage voor gebruik bij terugnavigatie
      localStorage.setItem('lastSearchState', JSON.stringify(searchState));
      
      console.log("Event geselecteerd en zoekstatus opgeslagen:", event.title);
    }
  }, [currentBounds, currentZoom, searchQuery]);
  
  // Maak navigatiefunctie beschikbaar voor de zoekbalk
  React.useEffect(() => {
    (window as any).navigateToMapEvent = navigateToEvent;
    
    return () => {
      // Cleanup bij unmount
      delete (window as any).navigateToMapEvent;
    };
  }, [navigateToEvent]);
  
  // Kijk of er een event is waar we naartoe moeten navigeren
  React.useEffect(() => {
    // Als de onEventClick prop is aangeroepen, wordt targetEvent ingesteld
    if (targetEvent) {
      // Zorg ervoor dat het event als geselecteerd wordt gemarkeerd (popup openen)
      setSelectedEvent(targetEvent);
      
      // Voeg het event direct toe aan eventsData als het er nog niet in zit
      // Dit moet gebeuren VOORDAT we naar het event navigeren om ervoor te zorgen dat de marker meteen zichtbaar is
      if (!eventsData.some(e => e.id === targetEvent.id)) {
        console.log("Adding target event to events data for visibility:", targetEvent.title);
        setEventsData(prev => [...prev, targetEvent]);
      }
      
      // Een korte pauze geeft React tijd om het nieuwe event te renderen voordat we ernaar navigeren
      setTimeout(() => {
        // Navigeren naar het event
        const lat = Number(targetEvent.latitude);
        const lng = Number(targetEvent.longitude);
        
        if (mapRef.current) {
          // Eerst uitzoomen om de omgeving te laten zien, daarna inzoomen
          mapRef.current.setView([lat, lng], 14, {
            animate: true,
            duration: 0.5
          });
          
          // Na een korte pauze inzoomen om het event goed te tonen
          setTimeout(() => {
            if (mapRef.current) {
              mapRef.current.flyTo([lat, lng], 16, {
                animate: true,
                duration: 1
              });
            }
          }, 300);
        }
      }, 100);
      
      // Reset targetEvent
      setTargetEvent(null);
    }
  }, [targetEvent, mapRef]);
  
  // Functie wordt al geëxporteerd via React.useEffect hierboven
  


  // Controleer of een event is verlopen
  const isEventExpired = (event: EventInterface): boolean => {
    return new Date(event.endTime || event.startTime) < new Date();
  };
  
  // Format events voor gebruik op de kaart en filter op basis van huidige kaartgrenzen en expired status
  const formattedEvents = React.useMemo(() => {
    if (!eventsData) return [];
    
    return eventsData
      .filter(event => {
        // Filter verlopen events op basis van de showExpiredEvents instelling
        if (!showExpiredEvents && isEventExpired(event)) {
          return false;
        }
        
        // Als er geen bounds zijn, toon alle events
        if (!currentBounds) return true;
        
        // Check of het event binnen de huidige kaartgrenzen valt
        const eventLatLng = L.latLng(Number(event.latitude), Number(event.longitude));
        return currentBounds.contains(eventLatLng);
      })
      .map(event => ({
        id: event.id,
        title: event.title,
        coords: [Number(event.latitude), Number(event.longitude)] as [number, number],
        category: event.category,
        startTime: event.startTime,
        expired: isEventExpired(event),
        event
      }));
  }, [eventsData, currentBounds, showExpiredEvents]);
  
  // Render de kaart
  return (
    <div className="h-full w-full relative flex-1 overflow-hidden z-0">
      {/* Filter controls voor kaartstijl en verlopen events */}
      <div className="absolute top-4 right-4 z-[150] flex flex-col gap-2">
        {/* Event filters */}
        <Button 
          size="sm" 
          variant={showExpiredEvents ? "default" : "outline"}
          className="flex items-center justify-center shadow-md w-8 h-8 p-0"
          title="Toon verlopen events"
          onClick={() => {
            const newValue = !showExpiredEvents;
            setShowExpiredEvents(newValue);
            // Als er een onShowExpiredEvents prop is, deze aanroepen
            if (propShowExpiredEvents !== undefined && onShowExpiredEventsChange) {
              onShowExpiredEventsChange(newValue);
            }
          }}
        >
          <Clock className="h-4 w-4" />
        </Button>

        {/* Kaartstijl selector met dropdown */}
        <div className="relative" ref={layerMenuRef}>
          <Button 
            size="sm" 
            variant={showLayerOptions ? "default" : "outline"}
            className="flex items-center justify-center shadow-md w-8 h-8 p-0"
            title="Kaartstijlen"
            onClick={() => setShowLayerOptions(!showLayerOptions)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-layers">
              <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/>
              <path d="m22 12-8.6 3.91a2 2 0 0 1-1.74 0L3 12"/>
              <path d="m22 17-8.6 3.91a2 2 0 0 1-1.74 0L3 17"/>
            </svg>
          </Button>
          
          {showLayerOptions && (
            <div className="absolute top-full right-0 mt-2 bg-white dark:bg-zinc-800 rounded-md shadow-lg p-2 z-[200]">
              <div className="flex flex-col space-y-2">
                <Button 
                  size="sm" 
                  variant={mapStyle === 'default' ? "default" : "outline"}
                  onClick={() => {
                    setMapStyle('default');
                    setShowLayerOptions(false);
                  }}
                  className="text-xs px-3 py-1 h-auto whitespace-nowrap"
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
                  className="text-xs px-3 py-1 h-auto whitespace-nowrap"
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
                  className="text-xs px-3 py-1 h-auto whitespace-nowrap"
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
        zoomControl={!hideZoomControls}
        className="z-10 map-container"
        attributionControl={false}
        ref={(map) => { 
          if (map) {
            mapRef.current = map;
          }
        }}
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
            icon={createEventIcon(
              event.category, 
              event.expired, 
              selectedEvent?.id === event.id
            )}
            eventHandlers={{
              click: () => {
                setSelectedEvent(event.event);
                if (onEventClick) {
                  onEventClick(event.event);
                }
              }
            }}
            // Open de popup automatisch als dit het geselecteerde event is
            ref={(markerRef) => {
              if (markerRef && selectedEvent && selectedEvent.id === event.id) {
                setTimeout(() => {
                  markerRef.openPopup();
                }, 200);
              }
            }}
          >
            <Popup>
              <Card className="border-0 shadow-none">
                {event.event.imageUrl && (
                  <div className="relative w-full h-32 overflow-hidden rounded-t-md">
                    <img 
                      src={event.event.imageUrl} 
                      alt={event.title} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <CardHeader className="p-2 pb-0">
                  <CardTitle className="text-base">
                    {event.title}
                  </CardTitle>
                  <CardDescription className="flex items-center text-xs">
                    <MapPin className="h-3 w-3 mr-1" />
                    <span>
                      {event.event.address || 
                       getLocationName(event.coords[0], event.coords[1])}
                    </span>
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
                  {event.expired && (
                    <div className="mt-1 text-xs text-red-500 font-medium">
                      Dit evenement is verlopen
                    </div>
                  )}
                </CardContent>
                <CardFooter className="p-2 pt-0">
                  {window.location.pathname.includes('/web') ? (
                    <Button 
                      size="sm" 
                      className="w-full bg-primary text-white hover:bg-primary/90 border border-primary"
                      onClick={() => onEventClick?.(event.event)}
                    >
                      Bekijk details
                    </Button>
                  ) : (
                    <Button asChild size="sm" className="w-full bg-primary text-white hover:bg-primary/90 border border-primary">
                      <Link href={`/app/event/${event.id}?returnTo=${encodeURIComponent(window.location.pathname)}`}>
                        Bekijk details
                      </Link>
                    </Button>
                  )}
                </CardFooter>
              </Card>
            </Popup>
          </Marker>
        ))}
        
        {/* Component om kaart te centreren op gebruiker */}
        <MapCenter lat={userLocation[0]} lng={userLocation[1]} />
        
        {/* Component om events bij te werken bij in/uitzoomen en verschuiven van de kaart */}
        <MapEventLoader 
          onBoundsChange={bounds => {
            setCurrentBounds(bounds);
            // Sla de bounds op in een globale variabele voor gebruik in zoekfunctie
            (window as any).currentMapBounds = bounds;
            // Stuur bounds door naar parent component via props
            if (propOnBoundsChange) {
              propOnBoundsChange(bounds);
            }
          }} 
          onZoomChange={zoom => {
            setCurrentZoom(zoom);
            // Stuur zoom door naar parent component via props
            if (propOnZoomChange) {
              propOnZoomChange(zoom);
            }
          }} 
        />
      </MapContainer>
      
      {/* Overlay verwijderd - we gebruiken alleen de popup bij de marker */}
    </div>
  );
}