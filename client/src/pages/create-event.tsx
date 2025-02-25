import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { useQueryClient } from "@tanstack/react-query"
import { zodResolver } from "@hookform/resolvers/zod"
import { useLocation } from "wouter"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { X } from "lucide-react"
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
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import { apiRequest } from "@/lib/queryClient"

const RECURRENCE_OPTIONS = [
  { label: "Eenmalig", value: "once" },
  { label: "Dagelijks", value: "daily" },
  { label: "Wekelijks", value: "weekly" },
  { label: "Maandelijks", value: "monthly" }
]

const DEFAULT_CENTER = [52.1326, 5.2913] // Center of Netherlands
const DEFAULT_ZOOM = 6 // Zoomed out to show ~175km radius
const DEFAULT_REACH = 2 // Default radius in km
const MIN_REACH = 1
const MAX_REACH = 5

function getNextHour() {
  const now = new Date()
  return setMilliseconds(setSeconds(setMinutes(addHours(now, 1), 0), 0), 0)
}

const createEventFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
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
});

export default function CreateEventPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [position, setPosition] = useState({ 
    lat: DEFAULT_CENTER[0], 
    lng: DEFAULT_CENTER[1],
    notificationReach: DEFAULT_REACH 
  });
  const [mapInitialized, setMapInitialized] = useState(false);

  const nextHour = getNextHour();
  const defaultEndTime = addHours(nextHour, 1);

  const form = useForm<z.infer<typeof createEventFormSchema>>({
    resolver: zodResolver(createEventFormSchema),
    defaultValues: {
      title: "",
      description: "",
      location: {
        lat: position.lat,
        lng: position.lng,
        notificationReach: DEFAULT_REACH,
      },
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
      hostId: 1, // This will be replaced with actual user ID when auth is implemented
    },
  });

  useEffect(() => {
    if ("geolocation" in navigator && !mapInitialized) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newPos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            notificationReach: form.getValues().location.notificationReach || DEFAULT_REACH,
          };
          setPosition(newPos);
          form.setValue("location", newPos);
          setMapInitialized(true);
        },
        (error) => {
          console.error("Error getting location:", error);
          // Keep default Netherlands center
          setMapInitialized(true);
          toast({
            title: "Location Access Error",
            description: "Could not access your location. Using default location.",
            variant: "destructive",
          });
        }
      );
    }
  }, []);

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
      <>
        <Marker position={position} />
        <Circle
          center={position}
          radius={position.notificationReach * 1000}
          pathOptions={{ color: 'blue', fillColor: 'blue', fillOpacity: 0.2 }}
        />
      </>
    );
  }

  async function onSubmit(data: z.infer<typeof createEventFormSchema>) {
    try {
      const startDateTime = new Date(`${data.startDate}T${data.startTime}`);
      const endDateTime = data.endDate && data.endTime 
        ? new Date(`${data.endDate}T${data.endTime}`)
        : null;

      const eventData = {
        title: data.title,
        description: data.description,
        latitude: data.location.lat.toString(),
        longitude: data.location.lng.toString(),
        notificationReach: data.location.notificationReach.toString(),
        category: data.category,
        subcategory: data.subcategory,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime?.toISOString() || null,
        isPaid: data.isPaid,
        price: data.price || null,
        maxParticipants: data.maxParticipants,
        hostId: data.hostId,
        recurrence: data.recurrence,
      };

      console.log("Sending event data:", eventData);
      await apiRequest('POST', '/api/events', eventData);

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

  return (
    <div className="container max-w-2xl mx-auto py-10">
      <Card className="p-6 relative">
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-4"
          onClick={() => setLocation('/')}
        >
          <X className="h-4 w-4" />
        </Button>

        <h1 className="text-2xl font-bold mb-6">Create New Event</h1>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event Title *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter event title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>Location *</FormLabel>
              <div className="h-[200px] rounded-md overflow-hidden relative z-10 border-[5px] border-gray-200">
                <MapContainer
                  center={[position.lat, position.lng]}
                  zoom={mapInitialized && position.lat !== DEFAULT_CENTER[0] ? 13 : DEFAULT_ZOOM}
                  className="h-full"
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <LocationMarker />
                </MapContainer>
              </div>
            </div>

            <FormField
              control={form.control}
              name="notificationReach"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notification Reach</FormLabel>
                  <FormControl>
                    <Slider
                      min={MIN_REACH}
                      max={MAX_REACH}
                      step={0.1}
                      value={[position.notificationReach]}
                      onValueChange={(vals) => {
                        const value = vals[0]
                        field.onChange(value)
                        setPosition({...position, notificationReach: value}) 
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Notification radius: {position.notificationReach} km
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>Category *</FormLabel>
              <CategoryPicker
                onCategoryChange={(main, sub) => {
                  form.setValue("category", main)
                  form.setValue("subcategory", sub)
                }}
              />
              <FormMessage />
            </div>

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

            <Button type="submit" className="w-full">
              Create Event
            </Button>
          </form>
        </Form>
      </Card>
    </div>
  );
}