import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.webpack.css";
import "leaflet-defaulticon-compatibility";
import { DraggableMarker } from "@/components/Map/DraggableMarker";
import BottomNav from "@/components/Layout/BottomNav";
import { defaultMapCenter, defaultZoom } from "@/components/Map/constants";
import { getHoverDivStyle, createNotificationRadiusCircle } from "@/lib/leaflet-map-style";
import { MapPin } from "lucide-react";
import { useLocation } from "wouter";
import { getNextHour, addHours } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import TopNav from "@/components/Layout/TopNav";
import { DatePicker } from "@/components/date-time-picker";
import { X, Satellite } from "lucide-react";
import { format } from "date-fns";

// Function to set map view to coordinates
function MapViewSetter({ center, zoom }: { center: [number, number]; zoom: number }) {
  useEffect(() => {
    const map = window.leafletMap;
    if (map) {
      map.setView(center, zoom);
    }
  }, [center, zoom]);

  return null;
}

export default function CreateEvent() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [hoverPosition, setHoverPosition] = useState<[number, number] | null>(null);
  const [markerPosition, setMarkerPosition] = useState<[number, number] | null>(null);
  const [isMapInitialized, setIsMapInitialized] = useState(false);
  const [notificationRadius, setNotificationRadius] = useState<number>(500);

  const [eventDate, setEventDate] = useState<Date>(new Date());
  const [eventTime, setEventTime] = useState<Date>(getNextHour());

  const defaultStartTime = getNextHour();
  const defaultEndTime = addHours(defaultStartTime, 1);

  const form = useForm({
    defaultValues: {
      title: "",
      description: "",
      location: "",
      latitude: 0,
      longitude: 0,
      startDate: defaultStartTime,
      endDate: defaultEndTime,
    },
  });

  const combineDateAndTime = (date: Date, time: Date): Date => {
    const result = new Date(date);
    result.setHours(time.getHours());
    result.setMinutes(time.getMinutes());
    return result;
  };

  const handleSubmit = form.handleSubmit(async (data) => {
    if (!markerPosition) {
      toast({
        title: "Error",
        description: "Please select a location on the map",
        variant: "destructive",
      });
      return;
    }

    const [latitude, longitude] = markerPosition;

    const startDateTime = combineDateAndTime(eventDate, eventTime);
    const endDateTime = addHours(startDateTime, 1);

    const eventData = {
      ...data,
      latitude,
      longitude,
      startDate: startDateTime.toISOString(),
      endDate: endDateTime.toISOString(),
    };

    console.log("Creating event:", eventData);

    try {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventData),
      });

      if (!response.ok) {
        throw new Error("Failed to create event");
      }

      toast({
        title: "Success",
        description: "Event created successfully",
      });

      // Invalidate events query to refetch
      queryClient.invalidateQueries({ queryKey: ["events"] });

      // Navigate back to home
      navigate("/");
    } catch (error) {
      console.error("Error creating event:", error);
      toast({
        title: "Error",
        description: "Failed to create event",
        variant: "destructive",
      });
    }
  });

  useEffect(() => {
    const mapContainer = document.getElementById("map");
    if (!mapContainer || isMapInitialized) return;

    // Wait for the map to be initialized by the parent component
    const checkMap = setInterval(() => {
      if (window.leafletMap) {
        clearInterval(checkMap);
        setIsMapInitialized(true);

        const map = window.leafletMap;

        map.on("click", (e: any) => {
          const { lat, lng } = e.latlng;
          setMarkerPosition([lat, lng]);
          form.setValue("latitude", lat);
          form.setValue("longitude", lng);
        });

        map.on("mousemove", (e: any) => {
          const { lat, lng } = e.latlng;
          setHoverPosition([lat, lng]);
        });

        map.on("mouseout", () => {
          setHoverPosition(null);
        });
      }
    }, 100);

    return () => {
      clearInterval(checkMap);
    };
  }, [isMapInitialized, form]);

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <div id="map" className="h-screen w-full" />

      {isMapInitialized && (
        <>
          {markerPosition && (
            <DraggableMarker
              position={markerPosition}
              setPosition={(pos) => {
                setMarkerPosition(pos);
                form.setValue("latitude", pos[0]);
                form.setValue("longitude", pos[1]);
              }}
            />
          )}

          {markerPosition &&
            createNotificationRadiusCircle(markerPosition, notificationRadius)}

          {hoverPosition && (
            <div
              style={getHoverDivStyle(hoverPosition)}
              className="absolute z-[400] hidden md:flex items-center justify-center bg-white rounded-full shadow-lg pointer-events-none"
            >
              <MapPin className="h-4 w-4 text-primary" />
            </div>
          )}

          <MapViewSetter center={defaultMapCenter} zoom={defaultZoom} />
        </>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 transition-transform duration-300 transform translate-y-0 animate-slide-up">
        <Card className="rounded-t-xl max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white z-10 flex justify-between items-center p-4 border-b">
            <h2 className="text-xl font-bold">Create Event</h2>
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <CardContent className="p-5">
            <Form {...form}>
              <form onSubmit={handleSubmit} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter event title" {...field} />
                      </FormControl>
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
                        <Textarea
                          placeholder="Describe your event"
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter location name" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <FormLabel>Date</FormLabel>
                    <DatePicker
                      date={eventDate}
                      setDate={setEventDate}
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <FormLabel>Time</FormLabel>
                    <DatePicker
                      date={eventTime}
                      setDate={setEventTime}
                      className="w-full"
                      mode="time"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <FormLabel>Notification Radius (meters)</FormLabel>
                  <Input
                    type="range"
                    min="100"
                    max="2000"
                    step="100"
                    value={notificationRadius}
                    onChange={(e) => setNotificationRadius(Number(e.target.value))}
                  />
                  <div className="text-sm text-gray-500 text-center">
                    {notificationRadius} meters
                  </div>
                </div>

                <Button type="submit" className="w-full">
                  Create Event
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
      <BottomNav />
    </div>
  );
}