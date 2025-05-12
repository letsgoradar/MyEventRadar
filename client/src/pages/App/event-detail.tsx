import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
import AppLayout from "@/components/App/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CalendarDays,
  Clock,
  MapPin,
  Users,
  ChevronLeft,
  Heart,
  Share2,
  AlertCircle,
  Map as MapIcon,
  Euro,
  MessageCircle,
  Search,
  ChevronRight,
} from "lucide-react";
import { CategoryIcon, getCategoryColor } from "@/components/CategoryIcon";
import { formatDistanceToNow, format, differenceInHours } from "date-fns";
import { nl } from "date-fns/locale";
import { apiRequest } from "@/lib/api";
import { EventInterface } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import 'leaflet/dist/leaflet.css';
import '@/components/Events/leaflet-fix.css';
import { getLocationName } from "@/utils/location-utils";
import L from 'leaflet';

export function AppEventDetail() {
  // Basisvariabelen definiëren
  const { id } = useParams<{ id: string }>(); // Gebruik alleen useParams
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const eventId = parseInt(id || '0');
  
  // Alle state hooks samen definiëren (consistent)
  const [returnTo, setReturnTo] = useState('/app');
  const [hasSearchState, setHasSearchState] = useState(false);
  
  // Data fetching met React Query
  const { data: event, isLoading, error } = useQuery<EventInterface>({
    queryKey: [`/api/events/${eventId}`],
    enabled: !isNaN(eventId) && eventId > 0,
  });

  // Effect voor het ophalen van de returnTo parameter
  useEffect(() => {
    // URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const returnParam = urlParams.get('returnTo');
    if (returnParam) {
      setReturnTo(returnParam);
    }
    
    // Zoekstatus ophalen uit localStorage
    try {
      const lastSearchState = localStorage.getItem('lastSearchState');
      if (lastSearchState) {
        const searchState = JSON.parse(lastSearchState);
        // Controleer of de zoekstatus nog geldig is (max 1 uur oud)
        const isValid = (new Date().getTime() - searchState.timestamp) < (60 * 60 * 1000);
        setHasSearchState(isValid);
      }
    } catch (e) {
      console.error("Fout bij parsen van zoekstatus:", e);
    }
  }, []);
  
  // Laad-toestand weergeven
  if (isLoading) {
    return (
      <AppLayout 
        title="Evenement"
        hideSearchAndFilters={true}
      >
        <div className="p-4">
          <div className="animate-pulse space-y-4">
            <div className="h-48 bg-gray-200 rounded-md" />
            <div className="h-8 bg-gray-200 rounded-md w-3/4" />
            <div className="h-4 bg-gray-200 rounded-md w-1/2" />
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded-md" />
              <div className="h-4 bg-gray-200 rounded-md" />
              <div className="h-4 bg-gray-200 rounded-md w-5/6" />
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Fout of geen data weergeven
  if (error || !event) {
    return (
      <AppLayout 
        title="Evenement niet gevonden"
        hideSearchAndFilters={true}
      >
        <div className="p-4">
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
            <h2 className="text-xl font-bold mb-2">Evenement niet gevonden</h2>
            <p className="text-muted-foreground mb-6">
              Het opgevraagde evenement bestaat niet of is niet meer beschikbaar.
            </p>
            <Button asChild>
              <Link href={returnTo}>Terug naar overzicht</Link>
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Bereken countdown en bepaal urgentie
  const now = new Date();
  const startTime = new Date(event.startTime);
  const endTime = event.endTime ? new Date(event.endTime) : new Date(startTime.getTime() + 2 * 60 * 60 * 1000); // Default 2 uur
  const isEventActive = now >= startTime && now <= endTime;
  const isEventPast = now > endTime;
  const hoursToEvent = differenceInHours(startTime, now);
  const isUrgent = hoursToEvent > 0 && hoursToEvent < 12;

  // Bepaal hoe lang het evenement duurt
  const durationHours = differenceInHours(endTime, startTime);
  
  // Formatteer data voor weergave
  const formattedDate = format(startTime, "EEEE d MMMM yyyy", { locale: nl });
  const formattedStartTime = format(startTime, "HH:mm", { locale: nl });
  const formattedEndTime = format(endTime, "HH:mm", { locale: nl });
  
  const timeAgo = formatDistanceToNow(startTime, { addSuffix: true, locale: nl });

  // Beheerder functie voor het bewerken van een evenement
  const handleEdit = () => {
    navigate(`/admin/events/edit/${eventId}`);
  };

  // Functie om een custom marker icon te maken op basis van de categorie
  function createEventIcon(category: string) {
    const color = getCategoryColor(category as any);
    return L.divIcon({
      className: 'custom-div-icon',
      html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });
  }

  // Component voor de evenement locatie op een kaart
  const EventLocation = ({ lat, lng }: { lat: number; lng: number }) => {
    return (
      <div className="h-[200px] w-full rounded-md overflow-hidden mb-6">
        <MapContainer 
          center={[lat, lng]} 
          zoom={14} 
          scrollWheelZoom={false}
          zoomControl={false}
          dragging={false}
          doubleClickZoom={false}
          style={{ height: '100%', width: '100%' }}
          className="event-detail-map"
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
          />
          <Marker 
            position={[lat, lng]} 
            icon={createEventIcon(event.category)}
          />
        </MapContainer>
      </div>
    );
  };

  // Component voor de afbeeldingengalerij
  const ImageGallery = ({ imageUrls }: { imageUrls: string[] }) => {
    if (!imageUrls || imageUrls.length === 0) return null;
    
    return (
      <div className="mb-6">
        <div className="relative h-64 w-full rounded-md overflow-hidden">
          <img 
            src={imageUrls[0]} 
            alt={event.title} 
            className="w-full h-full object-cover"
          />
          {imageUrls.length > 1 && (
            <div className="absolute bottom-2 right-2 bg-black/50 text-white px-2 py-1 rounded-md text-xs">
              +{imageUrls.length - 1} foto's
            </div>
          )}
        </div>
        
        {imageUrls.length > 1 && (
          <div className="grid grid-cols-4 gap-2 mt-2">
            {imageUrls.slice(1, 5).map((url, idx) => (
              <div key={idx} className="aspect-square rounded-md overflow-hidden">
                <img 
                  src={url} 
                  alt={`${event.title} afbeelding ${idx + 2}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Functie om terug te navigeren naar de vorige zoekresultaten
  const navigateToSearchResults = () => {
    const lastSearchState = localStorage.getItem('lastSearchState');
    if (lastSearchState) {
      try {
        const searchState = JSON.parse(lastSearchState);
        
        // Navigeer terug naar de kaartpagina
        navigate('/app');
        
        // Er is een globale functie om bounds te herstellen die via App.tsx beschikbaar is gemaakt
        setTimeout(() => {
          console.log("Zoekstatus herstellen");
        }, 500);
      } catch (e) {
        console.error("Fout bij navigeren naar zoekresultaten:", e);
        navigate('/app');
      }
    } else {
      // Als er geen searchState is, ga gewoon terug naar de homepagina
      navigate('/app');
    }
  };

  // Deze state wordt nu in de hook-sectie bovenin beheerd
  // en is verwijderd om de volgorde van hooks te behouden

  // Voorbereiden van de juiste data voor weergave
  const eventImages = [event.imageUrl].filter(Boolean) as string[];
  const eventCoords: [number, number] = [Number(event.latitude), Number(event.longitude)];
  
  return (
    <AppLayout 
      title={event.title}
      hideSearchAndFilters={true}
    >
      <div className="pb-20">
        <div className="sticky top-0 bg-background z-10 flex items-center justify-between p-4 border-b">
          <div className="flex items-center">
            <Button variant="ghost" size="icon" asChild className="mr-2">
              <Link href={returnTo}>
                <ChevronLeft className="h-5 w-5" />
              </Link>
            </Button>
            
            {/* Toon alleen de "Terug naar zoekresultaten" knop als er een zoekstatus is */}
            {hasSearchState && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={navigateToSearchResults}
                className="text-xs"
              >
                <Search className="mr-1 h-3 w-3" />
                Terug naar zoekresultaten
              </Button>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon">
              <Heart className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon">
              <Share2 className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="p-4">
          <ImageGallery imageUrls={eventImages} />
          
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h1 className="text-2xl font-bold">{event.title}</h1>
                
                <div className="flex items-center space-x-1">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-8 w-8 rounded-full"
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
                    className="h-8 w-8 rounded-full"
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
              
              <div className="flex items-center gap-2 mb-4">
                {event.category && (
                  <Badge 
                    className="gap-1 items-center"
                    style={{ 
                      backgroundColor: `${getCategoryColor(event.category as any)}20`,
                      color: getCategoryColor(event.category as any),
                      borderColor: getCategoryColor(event.category as any)
                    }}
                    variant="outline"
                  >
                    <CategoryIcon category={event.category as any} size={12} className="" />
                    <span>{event.category}</span>
                  </Badge>
                )}
                {isEventActive && (
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 hover:bg-green-500/10">Nu bezig</Badge>
                )}
                {isEventPast && (
                  <Badge variant="outline" className="bg-gray-500/10 text-gray-600 hover:bg-gray-500/10">Afgelopen</Badge>
                )}
                {!isEventActive && !isEventPast && isUrgent && (
                  <Badge variant="outline" className="bg-red-500/10 text-red-600 hover:bg-red-500/10">Binnenkort</Badge>
                )}
              </div>
            </div>
            
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <CalendarDays className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{formattedDate}</p>
                    <p className="text-sm text-muted-foreground">{timeAgo}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{formattedStartTime} - {formattedEndTime}</p>
                    <p className="text-sm text-muted-foreground">
                      {durationHours <= 24 
                        ? `${durationHours} uur` 
                        : `${Math.floor(durationHours / 24)} dagen en ${durationHours % 24} uur`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <h2 className="text-xl font-semibold mb-3">Details</h2>
                <div className="space-y-3">
                  {event.isPaid && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Prijs</h3>
                      <p>{Number(event.price).toFixed(2)} EUR</p>
                    </div>
                  )}
                  
                  {event.maxParticipants && Number(event.maxParticipants) > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Deelnemers</h3>
                      <p>Maximaal {event.maxParticipants} deelnemers</p>
                    </div>
                  )}
                  
                  <Separator />
                  
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Categorie</h3>
                    <div className="flex items-center mt-1">
                      <CategoryIcon category={event.category as any} className="mr-2" />
                      <span>{event.category}</span>
                    </div>
                  </div>
                  
                  {event.secondaryCategory && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Extra categorie</h3>
                      <div className="flex items-center mt-1">
                        <CategoryIcon category={event.secondaryCategory as any} className="mr-2" />
                        <span>{event.secondaryCategory}</span>
                      </div>
                    </div>
                  )}
                  
                  <Separator />
                  
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Organisator</h3>
                    <p>{event.hostId ? `Host ID: ${event.hostId}` : 'Onbekend'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {event.latitude && event.longitude && (
              <Card>
                <CardContent className="pt-6">
                  <h2 className="text-xl font-semibold mb-3">Locatie</h2>
                  
                  <div className="flex items-center mb-3 text-sm">
                    <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{getLocationName(Number(event.latitude), Number(event.longitude))}</div>
                      {event.address && <div className="text-muted-foreground">{event.address}</div>}
                    </div>
                  </div>
                  
                  <EventLocation lat={Number(event.latitude)} lng={Number(event.longitude)} />
                  
                  <Button variant="secondary" className="w-full">
                    <MapIcon className="mr-2 h-4 w-4" /> Routebeschrijving
                  </Button>
                </CardContent>
              </Card>
            )}
            
            <div>
              <h2 className="text-xl font-bold mb-3">Beschrijving</h2>
              <div className="prose prose-sm max-w-none">
                <p className="whitespace-pre-line">{event.description}</p>
              </div>
            </div>
            
            {event.tags && event.tags.length > 0 && (
              <div>
                <h2 className="text-xl font-bold mb-3">Tags</h2>
                <div className="flex flex-wrap gap-2">
                  {event.tags.map((tag: string, i: number) => (
                    <Badge key={i} variant="secondary">{tag}</Badge>
                  ))}
                </div>
              </div>
            )}
            
            <div className="pt-6">
              <div className="flex space-x-3">
                <Button className="flex-1">
                  <Heart className="mr-2 h-4 w-4" /> Bewaren
                </Button>
                <Button variant="outline" className="flex-1">
                  <Share2 className="mr-2 h-4 w-4" /> Delen
                </Button>
                <Button variant="outline" className="flex-1">
                  <MessageCircle className="mr-2 h-4 w-4" /> Contact
                </Button>
              </div>
              
              <div className="mt-4">
                <Button className="w-full" size="lg">
                  Deelnemen
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default AppEventDetail;