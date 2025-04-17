import React, { useState } from 'react';
import { useParams } from 'wouter';
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
  ChevronLeft 
} from 'lucide-react';
import { Event } from '@shared/schema';
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
  // We gebruiken useState hier niet meer
  
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

  return (
    <WebLayout>
      <div className="flex-1 pb-12">
        <div className="max-w-5xl mx-auto overflow-visible">
          <div className="mb-6 flex items-center">
            <Button variant="ghost" asChild className="mr-4">
              <Link href="/web">
                <ChevronLeft className="mr-2 h-4 w-4" />
                Terug
              </Link>
            </Button>
            <Badge 
              style={{ 
                backgroundColor: `${getCategoryColor(event.category as any)}20`,
                color: getCategoryColor(event.category as any),
                borderColor: getCategoryColor(event.category as any)
              }}
              variant="outline" 
              className="h-8 text-base font-normal"
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
                    {eventDate.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })} - 
                    {endDate.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
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
                {/* Toon de afbeelding als deze beschikbaar is, anders een placeholder */}
                {event.imageUrl ? (
                  <img 
                    src={event.imageUrl || ''} 
                    alt={event.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/40"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-white text-lg font-medium">Geen afbeelding beschikbaar</span>
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
                  
                  <Tabs defaultValue="map">
                    <TabsList className="w-full mb-3">
                      <TabsTrigger value="map" className="flex-1">Kaart</TabsTrigger>
                      <TabsTrigger value="streetview" className="flex-1">Straatbeeld</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="map">
                      <div className="h-[300px] w-full rounded-md overflow-hidden mb-3">
                        <MapContainer
                          center={eventCoords}
                          zoom={14}
                          scrollWheelZoom={true}
                          style={{ height: '100%', width: '100%' }}
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
                      <div className="h-[300px] w-full rounded-md overflow-hidden mb-3">
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