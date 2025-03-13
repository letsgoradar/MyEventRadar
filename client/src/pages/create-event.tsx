import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { useQueryClient } from "@tanstack/react-query"
import { zodResolver } from "@hookform/resolvers/zod"
import { useLocation } from "wouter"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { X, Satellite } from "lucide-react"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { CategoryPicker } from "@/components/CategoryPicker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { format, addHours, setMinutes, setSeconds, setMilliseconds } from "date-fns"
import * as z from 'zod'
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import { apiRequest } from "@/lib/queryClient"
import React from 'react';
import TopNav from "@/components/Layout/TopNav";
import BottomNav from "@/components/Layout/BottomNav";
import { generateTags, generateDescription } from '@/lib/aiTagGenerator';

const DEFAULT_CENTER = [52.1326, 5.2913] // Center of Netherlands
const DEFAULT_ZOOM = 6 // For Netherlands overview
const LOCATION_ZOOM = 18 // For specific location
const MIN_REACH = 1
const MAX_REACH = 5

// Define the schema first
const createEventFormSchema = z.object({
  title: z.string().max(30, "Titel mag maximaal 30 karakters bevatten"),
  description: z.string(),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
    notificationReach: z.number().min(MIN_REACH).max(MAX_REACH),
  }, { required_error: "Location is required" }),
  category: z.string().min(1, "Category is required"),
  subcategory: z.string().optional(),
  startDate: z.string().min(1, "Start date is required"),
  startTime: z.string().min(1, "Start time is required"),
  endDate: z.string().optional(),
  endTime: z.string().optional(),
  isPaid: z.boolean(),
  price: z.number().optional(),
  maxParticipants: z.number(),
  recurrence: z.enum(['once', 'daily', 'weekly', 'monthly']),
  hostId: z.number(),
  tags: z.array(z.string()).max(5, "Maximaal 5 tags toegestaan"),
});

const RECURRENCE_OPTIONS = [
  { label: "Eenmalig", value: "once" },
  { label: "Dagelijks", value: "daily" },
  { label: "Wekelijks", value: "weekly" },
  { label: "Maandelijks", value: "monthly" }
];

function getNextHour() {
  const now = new Date()
  return setMilliseconds(setSeconds(setMinutes(addHours(now, 1), 0), 0), 0)
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
    notificationReach: 1,
  }), [urlLatitude, urlLongitude]);

  const [position, setPosition] = useState(initialPosition);
  const [zoom, setZoom] = useState(urlZoom ? parseInt(urlZoom) : DEFAULT_ZOOM);

  const form = useForm<z.infer<typeof createEventFormSchema>>({
    resolver: zodResolver(createEventFormSchema),
    defaultValues: {
      title: "",
      description: "",
      location: initialPosition,
      startDate: format(nextHour, 'yyyy-MM-dd'),
      startTime: format(nextHour, 'HH:mm'),
      endDate: format(defaultEndTime, 'yyyy-MM-dd'),
      endTime: format(defaultEndTime, 'HH:mm'),
      category: "",
      subcategory: "",
      isPaid: false,
      price: 0,
      maxParticipants: 0,
      recurrence: "once",
      hostId: 1,
      tags: [],
    },
  });

  // Initialize location
  useEffect(() => {
    if (urlLatitude && urlLongitude) {
      // Location from long-press
      setMapInitialized(true);
    } else if ("geolocation" in navigator && !mapInitialized) {
      // Try to get user's current location
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newPos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            notificationReach: 1,
          };
          setPosition(newPos);
          form.setValue("location", newPos);
          setZoom(LOCATION_ZOOM);
          setMapInitialized(true);
        },
        () => {
          console.error("Could not get user location");
          setMapInitialized(true);
          toast({
            title: "Location Access Error",
            description: "Could not access your location. Using default location.",
            variant: "destructive",
          });
        }
      );
    }
  }, [urlLatitude, urlLongitude, mapInitialized, form]);

  const updateLocation = (newLocation: { lat: number; lng: number }) => {
    const currentReach = form.getValues().location.notificationReach;
    const newPos = {
      ...newLocation,
      notificationReach: currentReach,
    };
    setPosition(newPos);
    form.setValue("location", newPos);
  };

  function LocationMarker() {
    useMapEvents({
      click(e) {
        updateLocation(e.latlng);
      },
    });

    return (
      <Marker position={[position.lat, position.lng]} />
    );
  }

  // Map tile styles
  const tileUrl = isSatelliteView
    ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

  const tileConfig = isSatelliteView
    ? { subdomains: [] }
    : { subdomains: 'abcd' };

  async function onSubmit(data: z.infer<typeof createEventFormSchema>) {
    try {
      const startDateTime = new Date(`${data.startDate}T${data.startTime}`);
      const endDateTime = data.endDate && data.endTime
        ? new Date(`${data.endDate}T${data.endTime}`)
        : null;

      const eventData = {
        title: data.title,
        description: data.description,
        location: {
          lat: data.location.lat,
          lng: data.location.lng,
          notificationReach: data.location.notificationReach,
        },
        category: data.category,
        subcategory: data.subcategory,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime?.toISOString() || null,
        isPaid: data.isPaid,
        price: data.price || null,
        maxParticipants: data.maxParticipants,
        hostId: data.hostId,
        recurrence: data.recurrence,
        tags: data.tags,
      };

      const response = await apiRequest('POST', '/api/events', eventData);

      queryClient.invalidateQueries({ queryKey: ['/api/events/nearby'] });

      toast({
        title: "Success",
        description: "Event created successfully",
      });

      setLocation('/');
    } catch (error) {
      console.error("Error creating event:", error);
      toast({
        title: "Error",
        description: "Failed to create event. Please check all required fields.",
        variant: "destructive",
      });
    }
  }

  // Watch title and category for auto-generating tags and description
  const title = form.watch("title");
  const category = form.watch("category");

  useEffect(() => {
    if (title && category) {
      const generatedTags = generateTags(title, category);
      form.setValue("tags", generatedTags);

      const generatedDesc = generateDescription({
        title,
        category,
        subcategory: form.getValues("subcategory"),
      });

      if (!form.getValues("description")) {
        form.setValue("description", generatedDesc);
      }
    }
  }, [title, category, form]);

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] overflow-hidden">
      <div className="absolute inset-y-0 right-0 w-full md:w-[600px] bg-white shadow-xl animate-slide-left">
        <div className="h-screen flex flex-col">
          <TopNav />
          <div className="flex-1 overflow-auto p-4 pb-24 pt-[6.5rem]">
            <Card className="p-6 relative">
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">Event Aanmaken</h1>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setLocation('/')}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Title field with character count */}
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Event Titel *</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              placeholder="Voer event titel in"
                              {...field}
                              maxLength={30}
                              onChange={(e) => {
                                field.onChange(e);
                                if (e.target.value && category) {
                                  const tags = generateTags(e.target.value, category);
                                  form.setValue("tags", tags);
                                }
                              }}
                            />
                            <span className="absolute right-2 top-2 text-xs text-gray-400">
                              {field.value.length}/30
                            </span>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Tags field */}
                  <FormField
                    control={form.control}
                    name="tags"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tags (max 5)</FormLabel>
                        <FormControl>
                          <div className="flex flex-wrap gap-2">
                            {field.value.map((tag, index) => (
                              <div
                                key={index}
                                className="bg-blue-100 text-blue-800 rounded-full px-3 py-1 text-sm flex items-center gap-2"
                              >
                                {tag}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newTags = field.value.filter((_, i) => i !== index);
                                    form.setValue("tags", newTags);
                                  }}
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                            {field.value.length < 5 && (
                              <Input
                                type="text"
                                placeholder="Voeg tag toe"
                                className="!w-auto"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const input = e.currentTarget;
                                    const value = input.value.trim();
                                    if (value && field.value.length < 5) {
                                      form.setValue("tags", [...field.value, value]);
                                      input.value = '';
                                    }
                                  }
                                }}
                              />
                            )}
                          </div>
                        </FormControl>
                        <FormDescription>
                          Tags worden automatisch gegenereerd, maar je kunt ze aanpassen
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Location field */}
                  <div className="space-y-2">
                    <FormLabel>Locatie *</FormLabel>
                    <div className="h-[200px] rounded-md overflow-hidden relative border-2 border-gray-200">
                      <Button
                        variant="outline"
                        size="icon"
                        className="absolute top-2 right-2 z-[1000] bg-white/90 hover:bg-white"
                        onClick={() => setIsSatelliteView(!isSatelliteView)}
                        title={isSatelliteView ? "Switch to Map View" : "Switch to Satellite View"}
                      >
                        <Satellite className={`h-4 w-4 ${isSatelliteView ? 'text-primary' : 'text-muted-foreground'}`} />
                      </Button>
                      <MapContainer
                        center={[position.lat, position.lng]}
                        zoom={zoom}
                        className="h-full w-full"
                        zoomControl={false}
                      >
                        <TileLayer url={tileUrl} {...tileConfig} />
                        <LocationMarker />
                      </MapContainer>
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="location.notificationReach"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notification Reach</FormLabel>
                        <FormControl>
                          <Slider
                            min={MIN_REACH}
                            max={MAX_REACH}
                            step={0.1}
                            value={[field.value]}
                            onValueChange={(vals) => {
                              const value = vals[0]
                              field.onChange(value)
                              setPosition({...position, notificationReach: value})
                            }}
                          />
                        </FormControl>
                        <FormDescription>
                          Notification radius: {field.value} km
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category *</FormLabel>
                        <FormControl>
                          <CategoryPicker {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="subcategory"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subcategory</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter subcategory" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="startDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Date *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="startTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Time *</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="endDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>End Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="endTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>End Time</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="recurrence"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Event Frequency</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select frequency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {RECURRENCE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="maxParticipants"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Participants</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Enter max participants"
                            {...field}
                            onChange={e => field.onChange(parseInt(e.target.value))}
                          />
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
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Enter event description" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isPaid"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Input
                            type="checkbox"
                            className="w-4 h-4"
                            checked={field.value}
                            onChange={e => field.onChange(e.target.checked)}
                          />
                        </FormControl>
                        <FormLabel>Is this a paid event?</FormLabel>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {form.watch("isPaid") && (
                    <FormField
                      control={form.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Price per person</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="Enter price"
                              {...field}
                              onChange={e => field.onChange(parseFloat(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setLocation('/')}
                    >
                      Annuleren
                    </Button>
                    <Button type="submit" className="flex-1">
                      Opslaan
                    </Button>
                  </div>
                </form>
              </Form>
            </Card>
          </div>
          <BottomNav />
        </div>
      </div>
    </div>
  );
}