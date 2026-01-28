import * as React from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker } from "react-leaflet";
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
import { ClusterLayer, shouldUseCluster } from "./ClusterLayer";

// Fix voor Leaflet iconen in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

// Radar configuratie
const RADAR_CONFIG = {
  SWEEP_DURATION: 5000, // 5 seconden per rotatie
  SIZE: 800, // pixels diameter
  COLOR: {
    primary: '34, 197, 94', // Groen RGB (tailwind green-500)
    glow: '22, 163, 74', // Donkerder groen (green-600)
  }
};

// Radar animatie is nu volledig CSS-based
// Dit elimineert React re-renders en maakt de animatie hardware-accelerated
// Event markers hebben ook onafhankelijke CSS animaties

// Pauzeer/hervat radar animatie via CSS class toggle
// Dit gebruikt animation-play-state voor browser-native pauzering
export function pauseRadarAnimation() {
  const sweepElement = document.querySelector('.radar-sweep-xl') as HTMLElement;
  if (sweepElement) {
    sweepElement.style.animationPlayState = 'paused';
  }
}

export function resumeRadarAnimation() {
  const sweepElement = document.querySelector('.radar-sweep-xl') as HTMLElement;
  if (sweepElement) {
    sweepElement.style.animationPlayState = 'running';
  }
}

// Bereken adaptieve radar grootte op basis van zoomlevel
function getAdaptiveRadarSize(zoomLevel: number): number {
  // Radar grootte neemt toe bij uitzoomen, af bij inzoomen
  // Zoom 8 = 1200px, Zoom 12 = 800px, Zoom 16 = 400px
  const baseSize = 800;
  const zoomFactor = Math.pow(1.15, 12 - zoomLevel);
  return Math.max(300, Math.min(1500, baseSize * zoomFactor));
}

// Component voor de gebruikerslocatie marker met animaties en adres
function UserLocationMarker({ 
  position, 
  onCenterMap,
  zoomLevel = 12
}: { 
  position: [number, number]; 
  onCenterMap: () => void;
  zoomLevel?: number;
}) {
  const [address, setAddress] = React.useState<string>("Adres laden...");
  const [isLoadingAddress, setIsLoadingAddress] = React.useState(true);
  const markerRef = React.useRef<L.Marker>(null);
  const map = useMap();
  // Radar animatie is nu pure CSS - geen JavaScript hoek tracking meer nodig

  // Haal het adres op via reverse geocoding
  React.useEffect(() => {
    const fetchAddress = async () => {
      try {
        setIsLoadingAddress(true);
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position[0]}&lon=${position[1]}&zoom=18&addressdetails=1`,
          {
            headers: {
              'Accept-Language': 'nl'
            }
          }
        );
        const data = await response.json();
        
        if (data.address) {
          const parts = [];
          if (data.address.road) parts.push(data.address.road);
          if (data.address.house_number) parts[0] = `${parts[0]} ${data.address.house_number}`;
          if (data.address.suburb) parts.push(data.address.suburb);
          if (data.address.city || data.address.town || data.address.village) {
            parts.push(data.address.city || data.address.town || data.address.village);
          }
          setAddress(parts.join(', ') || data.display_name?.split(',').slice(0, 2).join(',') || 'Onbekende locatie');
        } else {
          setAddress('Onbekende locatie');
        }
      } catch (error) {
        console.error('Fout bij ophalen adres:', error);
        setAddress('Adres niet beschikbaar');
      } finally {
        setIsLoadingAddress(false);
      }
    };

    fetchAddress();
  }, [position[0], position[1]]);

  // Aangepast icoon voor gebruikerslocatie met grote groene radar sweep
  // BELANGRIJK: iconSize klein houden (50x50) zodat alleen het centrum klikbaar is
  // De radar sweep wordt visueel groter gerenderd via CSS overflow
  // Adaptieve grootte op basis van zoomlevel
  const size = getAdaptiveRadarSize(zoomLevel);
  const clickableSize = 50; // Alleen het centrum is klikbaar
  const halfClickable = clickableSize / 2;
  const { primary, glow } = RADAR_CONFIG.COLOR;
  
  // Pure CSS radar animatie - geen JavaScript rotation nodig
  // Dit voorkomt React re-renders en maakt de animatie hardware-accelerated
  const sweepDuration = RADAR_CONFIG.SWEEP_DURATION;
  
  const userLocationIcon = L.divIcon({
    className: 'user-location-marker',
    html: `
      <div class="radar-wrapper-xl">
        <div class="radar-container-xl">
          <!-- Grote radar sweep effect met groene kleur - pure CSS animatie -->
          <div class="radar-sweep-xl"></div>
          <!-- Radar bereik cirkel -->
          <div class="radar-range-xl"></div>
        </div>
        <!-- Centrale punt - dit is het enige klikbare element -->
        <div class="radar-center-xl">
          <div class="radar-center-dot-xl"></div>
        </div>
      </div>
      <style>
        .radar-wrapper-xl {
          position: relative;
          width: ${clickableSize}px;
          height: ${clickableSize}px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .radar-container-xl {
          position: absolute;
          width: ${size}px;
          height: ${size}px;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }
        
        /* Radar bereik indicator - subtiele groene rand */
        .radar-range-xl {
          position: absolute;
          width: ${size - 20}px;
          height: ${size - 20}px;
          border-radius: 50%;
          border: 1px solid rgba(${primary}, 0.1);
          background: radial-gradient(
            circle, 
            transparent 0%, 
            transparent 80%, 
            rgba(${primary}, 0.02) 90%,
            rgba(${primary}, 0.04) 100%
          );
          pointer-events: none;
        }
        
        /* Roterende radar sweep - pure CSS @keyframes animatie */
        .radar-sweep-xl {
          position: absolute;
          width: ${size - 20}px;
          height: ${size - 20}px;
          border-radius: 50%;
          background: conic-gradient(
            from 0deg,
            transparent 0deg,
            transparent 300deg,
            rgba(${primary}, 0.03) 320deg,
            rgba(${primary}, 0.08) 340deg,
            rgba(${primary}, 0.15) 350deg,
            rgba(${primary}, 0.25) 357deg,
            rgba(${primary}, 0.12) 360deg
          );
          pointer-events: none;
          animation: radarSweepRotate ${sweepDuration}ms linear infinite;
          will-change: transform;
        }
        
        @keyframes radarSweepRotate {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        
        /* Centraal punt - groen thema - dit is klikbaar */
        .radar-center-xl {
          position: relative;
          width: 36px;
          height: 36px;
          background: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 12px rgba(${primary}, 0.5);
          z-index: 10;
          border: 2px solid rgba(${primary}, 0.4);
          cursor: pointer;
        }
        
        .radar-center-dot-xl {
          width: 20px;
          height: 20px;
          background: linear-gradient(135deg, rgb(${primary}) 0%, rgb(${glow}) 100%);
          border-radius: 50%;
          animation: centerPulseXL 2s ease-in-out infinite;
        }
        
        @keyframes centerPulseXL {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(${primary}, 0.5);
          }
          50% {
            transform: scale(0.9);
            box-shadow: 0 0 0 8px rgba(${primary}, 0.15);
          }
        }
      </style>
    `,
    iconSize: [clickableSize, clickableSize],
    iconAnchor: [halfClickable, halfClickable],
  });

  const handleClick = () => {
    // Centreer de kaart op de gebruikerslocatie
    map.flyTo(position, 15, {
      animate: true,
      duration: 1
    });
    
    // Open de popup
    if (markerRef.current) {
      markerRef.current.openPopup();
    }
    
    onCenterMap();
  };

  return (
    <Marker 
      ref={markerRef}
      position={position}
      icon={userLocationIcon}
      eventHandlers={{
        click: handleClick
      }}
    >
      <Popup className="user-location-popup" closeButton={true}>
        <div className="p-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>
            <p className="font-semibold text-sm text-blue-600">Jouw locatie</p>
          </div>
          <p className="text-xs text-gray-600 ml-5">
            {isLoadingAddress ? (
              <span className="text-gray-400">Adres laden...</span>
            ) : (
              address
            )}
          </p>
        </div>
      </Popup>
    </Marker>
  );
}

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
    
    // Handler voor start van pan/zoom - pauzeer radar animatie
    const handleInteractionStart = () => {
      pauseRadarAnimation();
    };
    
    // Handler voor einde van pan/zoom - hervat radar animatie
    const handleInteractionEnd = () => {
      resumeRadarAnimation();
    };
    
    // Registreer event handlers
    map.on('movestart', handleInteractionStart);
    map.on('zoomstart', handleInteractionStart);
    map.on('moveend', handleMoveEnd);
    map.on('moveend', handleInteractionEnd);
    map.on('zoomend', handleZoomEnd);
    map.on('zoomend', handleInteractionEnd);
    
    // Cleanup functie
    return () => {
      clearTimeout(initTimer);
      map.off('movestart', handleInteractionStart);
      map.off('zoomstart', handleInteractionStart);
      map.off('moveend', handleMoveEnd);
      map.off('moveend', handleInteractionEnd);
      map.off('zoomend', handleZoomEnd);
      map.off('zoomend', handleInteractionEnd);
    };
  }, [map]); // Alleen afhankelijk van map, niet van callback functies
  
  return null;
}

// Bereken de hoek van een event t.o.v. de gebruikerslocatie (in graden, 0 = noord, met de klok mee)
function calculateAngleFromUser(userLat: number, userLng: number, eventLat: number, eventLng: number): number {
  const dLng = eventLng - userLng;
  const dLat = eventLat - userLat;
  
  // Bereken hoek in radialen (atan2 geeft -PI tot PI)
  let angle = Math.atan2(dLng, dLat);
  
  // Converteer naar graden (0-360, met de klok mee vanaf noord)
  angle = angle * (180 / Math.PI);
  if (angle < 0) angle += 360;
  
  return angle;
}

// Functie om event markers te maken met onafhankelijke CSS animatie
// Event markers pulseren nu onafhankelijk van de radar sweep voor betere performance
function createEventIcon(
  category: string, 
  isExpired: boolean = false, 
  isSelected: boolean = false, 
  eventAngle: number = 0
) {
  const color = isExpired ? "#9CA3AF" : getCategoryColor(category as any);
  const size = isSelected ? 28 : 24;
  const wrapperSize = size + 20;
  const innerSize = size - 4;
  
  // Radar groene kleur voor scan effect
  const { primary } = RADAR_CONFIG.COLOR;
  const scanColor = `rgb(${primary})`;
  
  // Gebruik een langere pulse cyclus (3 seconden) voor subtielere animatie
  // De delay is gebaseerd op de eventAngle voor visuele spreiding
  const pulseDuration = 3;
  const staggerDelay = (eventAngle / 360) * pulseDuration;
  
  return L.divIcon({
    className: 'custom-div-icon event-marker-radar',
    html: `
      <div class="evt-radar-pin">
        <div class="evt-scan-ring" style="animation-delay: ${staggerDelay}s;"></div>
        <div class="evt-scan-glow" style="animation-delay: ${staggerDelay}s;"></div>
        <div class="evt-dot ${isSelected ? 'selected' : ''}">
          <div class="evt-inner" style="background-color: ${color};"></div>
        </div>
      </div>
      <style>
        .evt-radar-pin {
          position: relative;
          width: ${wrapperSize}px;
          height: ${wrapperSize}px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .evt-scan-ring {
          position: absolute;
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          border: 2px solid ${scanColor};
          opacity: 0;
          animation: evtScanRing ${pulseDuration}s ease-out infinite;
          will-change: transform, opacity;
        }
        
        .evt-scan-glow {
          position: absolute;
          width: ${size + 4}px;
          height: ${size + 4}px;
          border-radius: 50%;
          background: ${scanColor};
          opacity: 0;
          animation: evtScanGlow ${pulseDuration}s ease-out infinite;
          will-change: transform, opacity;
        }
        
        .evt-dot {
          position: relative;
          width: ${size}px;
          height: ${size}px;
          background: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 6px rgba(0,0,0,0.35);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        
        .evt-dot.selected {
          transform: scale(1.2);
          box-shadow: 0 3px 12px rgba(0,0,0,0.4);
        }
        
        .evt-inner {
          width: ${innerSize}px;
          height: ${innerSize}px;
          border-radius: 50%;
        }
        
        /* Scan ring animatie - subtiele pulse */
        @keyframes evtScanRing {
          0% {
            transform: scale(1);
            opacity: 0;
          }
          5% {
            transform: scale(1);
            opacity: 0.6;
          }
          25% {
            transform: scale(1.5);
            opacity: 0;
          }
          100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }
        
        /* Glow effect - subtiele flash */
        @keyframes evtScanGlow {
          0% {
            opacity: 0;
            filter: blur(0px);
          }
          5% {
            opacity: 0.4;
            filter: blur(4px);
          }
          20% {
            opacity: 0;
            filter: blur(8px);
          }
          100% {
            opacity: 0;
            filter: blur(8px);
          }
        }
      </style>
    `,
    iconSize: [wrapperSize, wrapperSize],
    iconAnchor: [wrapperSize/2, wrapperSize/2],
  });
}

interface FormattedEvent {
  id: number;
  title: string;
  coords: [number, number];
  category: string;
  expired: boolean;
  event: EventInterface;
  startTime: string | Date;
}

// Component die hover highlight afhandelt via directe Leaflet manipulatie (geen React state/re-render)
function HoverHighlightLayer({ events }: { events: FormattedEvent[] }) {
  const map = useMap();
  const highlightLayerRef = React.useRef<L.CircleMarker | null>(null);
  const eventsRef = React.useRef(events);
  
  // Update events ref zonder re-render te triggeren
  React.useEffect(() => {
    eventsRef.current = events;
  }, [events]);
  
  React.useEffect(() => {
    const handleEventHover = (e: Event) => {
      const customEvent = e as CustomEvent<{ eventId: number | null }>;
      const eventId = customEvent.detail.eventId;
      
      // Verwijder bestaande highlight
      if (highlightLayerRef.current) {
        map.removeLayer(highlightLayerRef.current);
        highlightLayerRef.current = null;
      }
      
      // Voeg nieuwe highlight toe als er een event is
      if (eventId !== null) {
        const event = eventsRef.current.find(e => e.id === eventId);
        if (event) {
          highlightLayerRef.current = L.circleMarker(event.coords, {
            radius: 25,
            color: `rgb(${RADAR_CONFIG.COLOR.primary})`,
            weight: 3,
            opacity: 0.8,
            fillColor: `rgb(${RADAR_CONFIG.COLOR.primary})`,
            fillOpacity: 0.2,
            className: 'hover-pulse-ring'
          }).addTo(map);
        }
      }
    };
    
    window.addEventListener('eventHover', handleEventHover);
    
    return () => {
      window.removeEventListener('eventHover', handleEventHover);
      if (highlightLayerRef.current) {
        map.removeLayer(highlightLayerRef.current);
      }
    };
  }, [map]);
  
  return null;
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
  selectedEventId?: number | null;
  hoveredEventId?: number | null;
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
  onShowExpiredEventsChange,
  selectedEventId: propSelectedEventId,
  hoveredEventId: propHoveredEventId
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
  
  // Sync de interne selectedEvent state met de externe prop
  React.useEffect(() => {
    if (propSelectedEventId === null || propSelectedEventId === undefined) {
      setSelectedEvent(null);
    }
  }, [propSelectedEventId]);

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
      {/* Kaartstijl selector rechtsonder */}
      <div className="absolute bottom-20 right-4 z-[150]">
        <div className="relative" ref={layerMenuRef}>
          <Button 
            size="sm" 
            variant={showLayerOptions ? "default" : "outline"}
            className="flex items-center justify-center shadow-md w-10 h-10 p-0 bg-white hover:bg-gray-50"
            title="Kaartstijlen"
            onClick={() => setShowLayerOptions(!showLayerOptions)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-layers">
              <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/>
              <path d="m22 12-8.6 3.91a2 2 0 0 1-1.74 0L3 12"/>
              <path d="m22 17-8.6 3.91a2 2 0 0 1-1.74 0L3 17"/>
            </svg>
          </Button>
          
          {showLayerOptions && (
            <div className="absolute bottom-full right-0 mb-2 bg-white dark:bg-zinc-800 rounded-md shadow-lg p-2 z-[200]">
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
        zoom={10}
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
        
        {/* Marker voor gebruiker locatie met animaties en adres - adaptieve radar grootte */}
        <UserLocationMarker 
          position={userLocation}
          zoomLevel={currentZoom}
          onCenterMap={() => {
            console.log('Kaart gecentreerd op gebruikerslocatie');
          }}
        />
        
        {/* Hover highlight component - gebruikt directe Leaflet manipulatie zonder React state */}
        <HoverHighlightLayer events={formattedEvents} />
        
        {/* Gebruik ClusterLayer bij veel events, anders individuele markers met radar animatie */}
        {shouldUseCluster(formattedEvents.length, currentZoom) ? (
          <ClusterLayer
            events={formattedEvents}
            onEventClick={(event) => {
              setSelectedEvent(event);
              if (onEventClick) onEventClick(event);
            }}
            selectedEventId={selectedEvent?.id}
            userLocation={userLocation}
          />
        ) : (
          /* Markers voor events met radar-gesynchroniseerde animatie */
          formattedEvents.map((event) => {
            const isSelected = selectedEvent?.id === event.id;
            const eventAngle = calculateAngleFromUser(
              userLocation[0], 
              userLocation[1], 
              event.coords[0], 
              event.coords[1]
            );
            return (
            <Marker 
              key={`${event.id}-${isSelected ? 'selected' : 'normal'}`}
              position={event.coords}
              icon={createEventIcon(
                event.category, 
                event.expired, 
                isSelected,
                eventAngle
              )}
              eventHandlers={{
                click: () => {
                  setSelectedEvent(event.event);
                },
                popupclose: () => {
                  if (selectedEvent?.id === event.id) {
                    setSelectedEvent(null);
                  }
                }
              }}
              ref={(markerRef) => {
                if (markerRef && selectedEvent && selectedEvent.id === event.id) {
                  if (!markerRef.isPopupOpen()) {
                    setTimeout(() => {
                      markerRef.openPopup();
                    }, 200);
                  }
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
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick?.(event.event);
                      }}
                    >
                      Bekijk details
                    </Button>
                  ) : (
                    <Button 
                      size="sm" 
                      className="w-full bg-primary text-white hover:bg-primary/90 border border-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick?.(event.event);
                      }}
                    >
                      Bekijk details
                    </Button>
                  )}
                </CardFooter>
              </Card>
            </Popup>
          </Marker>
            );
          })
        )}
        
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