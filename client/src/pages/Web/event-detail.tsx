import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Calendar, 
  Clock, 
  Euro, 
  Map as MapIcon, 
  Users, 
  Heart, 
  Share, 
  MessageCircle, 
  ChevronLeft,
  MapPin,
  ArrowLeft,
  Search,
  ChevronRight
} from 'lucide-react';
import { EventInterface } from '@shared/schema';
import { formatEventTimeRange } from '@/utils/date-utils';
import { WebLayout } from '@/components/Web/WebLayout';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import { CategoryIcon, getCategoryColor } from '@/components/CategoryIcon';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import StreetView from '@/components/StreetView/StreetView';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import 'leaflet/dist/leaflet.css';
import '@/components/Events/leaflet-fix.css';
import { getLocationName } from '@/utils/location-utils';

// Importeer L van leaflet
import L from 'leaflet';

// Nodig voor het Marker icoon
function createEventIcon(category: string) {
  const color = getCategoryColor(category as any);
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}

const EventDetail = () => {
  const { id } = useParams();
  
  // Haal de returnTo parameter uit de URL en location hook voor navigatie
  const [returnTo, setReturnTo] = useState('/web');
  const [, navigate] = useLocation();
  const [hasSearchState, setHasSearchState] = useState(false);
  
  useEffect(() => {
    // Parse de URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const returnParam = urlParams.get('returnTo');
    if (returnParam) {
      setReturnTo(returnParam);
    }
    
    // Controleer of er een opgeslagen zoekstatus is
    const lastSearchState = localStorage.getItem('lastSearchState');
    if (lastSearchState) {
      try {
        const searchState = JSON.parse(lastSearchState);
        // Controleer of de zoekstatus nog geldig is (max 1 uur oud)
        const isValid = (new Date().getTime() - searchState.timestamp) < (60 * 60 * 1000);
        setHasSearchState(isValid);
      } catch (e) {
        console.error("Fout bij parsen van zoekstatus:", e);
      }
    }
  }, []);
  
  // Fetch event details
  const { data: event, isLoading, error } = useQuery({
    queryKey: ['/api/events', id],
    queryFn: async () => {
      const response = await fetch(`/api/events/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch event details');
      }
      return response.json();
    },
    // Verbetering: stelt de query-caching in voor betere prestaties
    staleTime: 5 * 60 * 1000, // 5 minuten
  });

  if (isLoading) {
    return (
      <WebLayout>
        <div className="flex-1 py-8 px-6">
          <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
            <div className="h-10 bg-muted rounded w-1/3"></div>
            <div className="h-40 bg-muted rounded"></div>
            <div className="h-60 bg-muted rounded"></div>
          </div>
        </div>
      </WebLayout>
    );
  }

  if (error || !event) {
    return (
      <WebLayout>
        <div className="flex-1 py-8 px-6">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-4">Evenement niet gevonden</h1>
            <p className="text-muted-foreground mb-6">
              Het opgevraagde evenement bestaat niet of is niet beschikbaar.
            </p>
            <Button asChild>
              <Link href="/web">Terug naar Home</Link>
            </Button>
          </div>
        </div>
      </WebLayout>
    );
  }

  const eventCoords: [number, number] = [Number(event.latitude), Number(event.longitude)];
  const eventDate = new Date(event.startTime);
  const endDate = new Date(event.endTime);
  
  // Functie om terug te navigeren naar de vorige zoekresultaten
  const navigateToSearchResults = () => {
    const lastSearchState = localStorage.getItem('lastSearchState');
    if (lastSearchState) {
      try {
        const searchState = JSON.parse(lastSearchState);
        
        // Navigeer terug naar de kaartpagina
        navigate('/web');
        
        // Na korte vertraging de bounds en zoom herstellen via de globale functie
        setTimeout(() => {
          const map = (window as any).mapRef?.current;
          if (map && searchState.bounds) {
            // Converteer de bounds string terug naar een bounds object
            const [west, south, east, north] = searchState.bounds.split(',').map(Number);
            const bounds = L.latLngBounds(
              L.latLng(south, west),
              L.latLng(north, east)
            );
            
            // Kaart op de juiste positie zetten
            map.fitBounds(bounds);
            
            // Als er een zoekterm was, die ook weer herstellen
            if (searchState.searchQuery) {
              const searchInput = document.querySelector('input[placeholder="Zoek op kaart"]') as HTMLInputElement;
              if (searchInput) {
                searchInput.value = searchState.searchQuery;
                // Trigger een zoekopdracht
                const event = new Event('input', { bubbles: true });
                searchInput.dispatchEvent(event);
              }
            }
            
            console.log("Zoekstatus hersteld:", searchState);
          }
        }, 500);
      } catch (e) {
        console.error("Fout bij navigeren naar zoekresultaten:", e);
        navigate('/web');
      }
    } else {
      // Als er geen searchState is, ga gewoon terug naar de homepagina
      navigate('/web');
    }
  };

  return (
    <WebLayout>
      <div className="flex-1 pb-12 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto overflow-visible">
          <div className="mb-6 flex items-center flex-wrap">
            <div className="flex items-center mr-2 mb-2">
              <Button variant="ghost" asChild className="mr-2">
                <Link href={returnTo}>
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Terug
                </Link>
              </Button>
              
              {/* Toon alleen de "Terug naar zoekresultaten" knop als er een zoekstatus is */}
              {hasSearchState && (
                <Button 
                  variant="outline" 
                  onClick={navigateToSearchResults}
                  className="mr-2"
                >
                  <Search className="mr-2 h-4 w-4" />
                  Terug naar zoekresultaten
                </Button>
              )}
              
              {/* Vorige/volgende evenement navigatie knoppen */}
              <div className="flex items-center space-x-1">
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-9 w-9 rounded-full"
                  title="Vorig evenement"
                  onClick={() => {
                    // Zal later worden geïmplementeerd met echte functionaliteit
                    console.log("Navigatie naar vorig evenement");
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-9 w-9 rounded-full"
                  title="Volgend evenement"
                  onClick={() => {
                    // Zal later worden geïmplementeerd met echte functionaliteit
                    console.log("Navigatie naar volgend evenement");
                  }}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <Badge 
              style={{ 
                backgroundColor: `${getCategoryColor(event.category as any)}20`,
                color: getCategoryColor(event.category as any),
                borderColor: getCategoryColor(event.category as any)
              }}
              variant="outline" 
              className="h-8 text-base font-normal mb-2"
            >
              <CategoryIcon category={event.category as any} className="mr-2" size={18} />
              {event.category}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-6">
              <div>
                <h1 className="text-3xl font-bold mb-3">{event.title}</h1>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center">
                    <Calendar className="mr-2 h-4 w-4" />
                    {eventDate.toLocaleDateString('nl-NL', {
                      weekday: 'long', 
                      day: 'numeric', 
                      month: 'long', 
                      year: 'numeric'
                    })}
                  </div>
                  <div className="flex items-center">
                    <Clock className="mr-2 h-4 w-4" />
                    {formatEventTimeRange(event.startTime, event.endTime)}
                  </div>
                  {event.isPaid && (
                    <div className="flex items-center">
                      <Euro className="mr-2 h-4 w-4" />
                      {Number(event.price).toFixed(2)} EUR
                    </div>
                  )}
                  {event.maxParticipants && (
                    <div className="flex items-center">
                      <Users className="mr-2 h-4 w-4" />
                      Max {event.maxParticipants} deelnemers
                    </div>
                  )}
                </div>
              </div>

              <div className="relative h-[300px] overflow-hidden rounded-lg bg-muted">
                {/* Toon de afbeelding als deze beschikbaar is, anders een placeholder met Generate button */}
                {event.imageUrl ? (
                  <img 
                    src={event.imageUrl || ''} 
                    alt={event.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/40"></div>
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 gap-4">
                      <span className="text-white text-lg font-medium text-center">Geen afbeelding beschikbaar</span>
                      <a href={`/web/create-event?edit=${event.id}`} className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/90 transition-colors">
                        Evenement bewerken om afbeelding toe te voegen
                      </a>
                    </div>
                  </>
                )}
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-3">Beschrijving</h2>
                <p className="text-muted-foreground whitespace-pre-line">
                  {event.description || 'Geen beschrijving beschikbaar'}
                </p>
              </div>

              <div className="flex space-x-3">
                <Button className="flex-1">
                  <Heart className="mr-2 h-4 w-4" /> Bewaren
                </Button>
                <Button variant="outline" className="flex-1">
                  <Share className="mr-2 h-4 w-4" /> Delen
                </Button>
                <Button variant="outline" className="flex-1">
                  <MessageCircle className="mr-2 h-4 w-4" /> Contact
                </Button>
              </div>
            </div>

            <div className="space-y-6">
              <Card>
                <CardContent className="pt-6">
                  <h2 className="text-xl font-semibold mb-3">Locatie</h2>
                  
                  <div className="flex items-center mb-3 text-sm">
                    <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{getLocationName(eventCoords[0], eventCoords[1])}</div>
                      {event.address && <div className="text-muted-foreground">{event.address}</div>}
                    </div>
                  </div>
                  
                  <Tabs defaultValue="map">
                    <TabsList className="w-full mb-3">
                      <TabsTrigger value="map" className="flex-1">Kaart</TabsTrigger>
                      <TabsTrigger value="streetview" className="flex-1">Straatbeeld</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="map">
                      <div className="h-[300px] w-full rounded-md overflow-hidden mb-3 relative">
                        <MapContainer
                          center={eventCoords}
                          zoom={14}
                          scrollWheelZoom={false}
                          dragging={false}
                          zoomControl={false}
                          doubleClickZoom={false}
                          style={{ height: '100%', width: '100%', position: 'relative', zIndex: 5 }}
                          className="event-detail-map"
                        >
                          <TileLayer
                            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                            subdomains="abcd"
                          />
                          <Marker
                            position={eventCoords}
                            icon={createEventIcon(event.category)}
                          />
                        </MapContainer>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="streetview">
                      <div 
                        className="h-[300px] w-full rounded-md overflow-hidden mb-3 relative event-detail-streetview"
                        style={{ position: 'relative', zIndex: 5 }}
                      >
                        <StreetView
                          latitude={eventCoords[0]}
                          longitude={eventCoords[1]}
                        />
                      </div>
                    </TabsContent>
                  </Tabs>
                  
                  <Button variant="secondary" className="w-full">
                    <MapIcon className="mr-2 h-4 w-4" /> Routebeschrijving
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <h2 className="text-xl font-semibold mb-3">Details</h2>
                  
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Organisator</h3>
                      <p>{event.hostId ? `Host ID: ${event.hostId}` : 'Onbekend'}</p>
                    </div>
                    
                    <Separator />
                    
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Categorie</h3>
                      <div className="flex items-center mt-1">
                        <CategoryIcon category={event.category as any} className="mr-2" />
                        <span>{event.category}</span>
                      </div>
                    </div>
                    
                    {event.tags && event.tags.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <h3 className="text-sm font-medium text-muted-foreground">Tags</h3>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {event.tags.map((tag: string) => (
                              <Badge key={tag} variant="secondary">{tag}</Badge>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                    
                    <Separator />
                    
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Aangemaakt</h3>
                      <p>{new Date().toLocaleDateString('nl-NL')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </WebLayout>
  );
};

export default EventDetail;