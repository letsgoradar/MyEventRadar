import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MapContainer, TileLayer, Circle, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { setMilliseconds, setSeconds, setMinutes, addHours } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card } from "@/components/ui/card";
import { CategoryPicker } from "@/components/CategoryPicker";
import { DEFAULT_CENTER, DEFAULT_ZOOM, DEFAULT_NOTIFICATION_RADIUS } from "@/components/Map/constants";
import { DraggableMarker } from "@/components/Map/DraggableMarker";
import { DateTimePicker } from "@/components/date-time-picker";
import { getHoverDivStyle, createNotificationRadiusCircle } from "@/lib/leaflet-map-style";
import { MapPin } from "lucide-react";
import { useLocation } from "wouter";
import { getNextHour, addHours } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import TopNav from "@/components/Layout/TopNav";
import BottomNav from "@/components/Layout/BottomNav";
import { X, Satellite } from "lucide-react";
import { format } from "date-fns";


// Function to set map view to coordinates
function MapViewSetter({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  React.useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

export default function CreateEventPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [isSatelliteView, setIsSatelliteView] = useState(false);
  const [mapInitialized, setMapInitialized] = useState(false);

  // Get location from URL parameters (from long-press)
  const params = new URLSearchParams(window.location.search || "");
  const urlLatitude = params.get('lat');
  const urlLongitude = params.get('lng');
  const urlZoom = params.get('zoom');

  const nextHour = getNextHour();
  const defaultEndTime = addHours(nextHour, 1);

  const initialPosition = React.useMemo(() => ({
    lat: urlLatitude ? parseFloat(urlLatitude) : DEFAULT_CENTER[0],
    lng: urlLongitude ? parseFloat(urlLongitude) : DEFAULT_CENTER[1],
    notificationReach: 2,
  }), [urlLatitude, urlLongitude]);

  const [position, setPosition] = useState(initialPosition);
  const [zoom, setZoom] = useState(urlZoom ? parseInt(urlZoom) : 15);

  const formSchema = z.object({
    title: z.string().min(3, {
      message: "Title must be at least 3 characters.",
    }),
    description: z.string().optional(),
    startTime: z.date(),
    endTime: z.date(),
    category: z.string({
      required_error: "Please select a category.",
    }),
    subcategory: z.string().optional(),
    isPaid: z.boolean().default(false),
    price: z.string().optional(),
    maxParticipants: z.number().int().positive().optional(),
    location: z.object({
      lat: z.number(),
      lng: z.number(),
    }),
    notificationReach: z.number().min(0.5).max(10).default(DEFAULT_NOTIFICATION_RADIUS),
    recurrence: z.enum(["once", "daily", "weekly", "monthly"]).default("once"),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      startTime: nextHour,
      endTime: defaultEndTime,
      category: "sport",
      subcategory: "",
      isPaid: false,
      price: "",
      maxParticipants: 0,
      location: {
        lat: initialPosition.lat,
        lng: initialPosition.lng,
      },
      notificationReach: initialPosition.notificationReach,
      recurrence: "once",
    },
  });

  const handleFormSubmit = async (values: z.infer<typeof formSchema>) => {
    const eventData = {
      ...values,
      price: values.isPaid ? values.price : null,
      startDate: format(values.startTime, 'yyyy-MM-dd'),
      startTime: format(values.startTime, 'HH:mm'),
      endDate: format(values.endTime, 'yyyy-MM-dd'),
      endTime: format(values.endTime, 'HH:mm'),
      hostId: 1
    };

    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      });

      if (!response.ok) {
        throw new Error('Failed to create event');
      }

      toast({
        title: "Event Created",
        description: "Your event has been successfully created.",
      });

      queryClient.invalidateQueries({ queryKey: ['/api/events/nearby'] });

      setLocation('/');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create event. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handlePositionChange = (newPosition: { lat: number; lng: number }) => {
    setPosition({
      ...position,
      lat: newPosition.lat,
      lng: newPosition.lng,
    });
  };

  useEffect(() => {
    if (mapInitialized) return;

    if (navigator.geolocation && !urlLatitude && !urlLongitude) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const userLat = pos.coords.latitude;
          const userLng = pos.coords.longitude;
          setPosition({
            lat: userLat,
            lng: userLng,
            notificationReach: 2,
          });
          setZoom(15);
          setMapInitialized(true);
        },
        () => {
          setMapInitialized(true);
        }
      );
    } else {
      setMapInitialized(true);
    }
  }, [mapInitialized, urlLatitude, urlLongitude]);

  const mapCenter: [number, number] = [position.lat, position.lng];
  const tileUrl = isSatelliteView
    ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  return (
    <div className="h-screen flex flex-col relative">
      <TopNav />
      <div className="fixed inset-0 top-[60px] bottom-[68px] bg-transparent pointer-events-none z-10">
        <div 
          className="absolute inset-x-0 bottom-0 bg-white rounded-t-3xl shadow-lg transform transition-transform duration-300 ease-out pb-6 pointer-events-auto"
          style={{ height: '90%' }}
        >
          <div className="w-16 h-1 bg-gray-300 rounded-full mx-auto my-3"></div>
          <div className="px-4 pb-16 overflow-auto h-full">
            <Card className="border-0 shadow-none">
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-4"
                onClick={() => setLocation('/')}
              >
                <X className="h-4 w-4" />
              </Button>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Titel</FormLabel>
                        <FormControl>
                          <Input placeholder="Titel van het evenement" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Beschrijving</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Beschrijving van het evenement"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="startTime"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Start tijd</FormLabel>
                          <DateTimePicker
                            date={field.value}
                            setDate={field.onChange}
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="endTime"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Eind tijd</FormLabel>
                          <DateTimePicker
                            date={field.value}
                            setDate={field.onChange}
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Categorie</FormLabel>
                          <div className="relative z-20">
                            <CategoryPicker
                              value={field.value}
                              onValueChange={field.onChange}
                            />
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="maxParticipants"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max deelnemers</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="isPaid"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between">
                        <div className="space-y-0.5">
                          <FormLabel>Betaald evenement?</FormLabel>
                          <FormDescription>
                            Zet dit aan als deelnemers moeten betalen.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {form.watch("isPaid") && (
                    <FormField
                      control={form.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prijs (€)</FormLabel>
                          <FormControl>
                            <Input
                              type="text"
                              placeholder="0.00"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-base">Locatie</FormLabel>
                      <div className="flex items-center space-x-2">
                        <FormLabel htmlFor="satellite-view">Satelliet</FormLabel>
                        <Switch
                          id="satellite-view"
                          checked={isSatelliteView}
                          onCheckedChange={setIsSatelliteView}
                        />
                      </div>
                    </div>

                    <div className="relative border rounded-lg overflow-hidden" style={{ height: '200px', zIndex: 1 }}>
                      <MapContainer
                        center={mapCenter}
                        zoom={zoom}
                        style={{ height: '100%', width: '100%' }}
                        zoomControl={false}
                      >
                        <MapViewSetter center={mapCenter} zoom={zoom} />
                        <TileLayer
                          url={tileUrl}
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        />
                        <DraggableMarker
                          position={[position.lat, position.lng]}
                          setPosition={handlePositionChange}
                        />
                        <Circle 
                          center={[position.lat, position.lng]} 
                          radius={position.notificationReach * 1000}
                          pathOptions={{ color: '#0097FB', fillColor: '#0097FB', fillOpacity: 0.2 }}
                        />
                      </MapContainer>
                      <div className={getHoverDivStyle('absolute bottom-2 right-2 bg-white p-2 rounded shadow')}>
                        <div className="flex items-center space-x-1">
                          <MapPin className="w-4 h-4 text-red-500" />
                          <span className="text-xs font-medium">
                            {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      <FormLabel>Notificatie bereik (km)</FormLabel>
                      <div className="flex items-center space-x-4">
                        <Input
                          type="range"
                          min="0.5"
                          max="10"
                          step="0.5"
                          value={position.notificationReach}
                          onChange={(e) => setPosition({
                            ...position,
                            notificationReach: parseFloat(e.target.value),
                          })}
                          className="flex-1"
                        />
                        <span className="w-12 text-center">
                          {position.notificationReach} km
                        </span>
                      </div>
                    </div>
                  </div>

                  <Button type="submit" className="w-full">
                    Evenement Aanmaken
                  </Button>
                </form>
              </Form>
            </Card>
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}