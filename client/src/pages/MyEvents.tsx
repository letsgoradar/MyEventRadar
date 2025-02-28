
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useLocation } from "wouter";
import type { Event } from "@shared/schema";
import { MapPin, Calendar } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function MyEvents() {
  const [location] = useLocation();

  const { data: hostedEvents, isLoading: isLoadingHosted } = useQuery<Event[]>({
    queryKey: ["/api/users/hosted-events"], 
    queryFn: async () => {
      // In a real app, you would get the current user ID from auth
      const userId = 1; // Using a placeholder user ID
      const response = await fetch(`/api/users/${userId}/hosted-events`);
      if (!response.ok) {
        throw new Error('Failed to fetch hosted events');
      }
      return response.json();
    }
  });

  const { data: participatingEvents, isLoading: isLoadingParticipating } = useQuery<Event[]>({
    queryKey: ["/api/users/participating-events"],
    queryFn: async () => {
      // In a real app, you would get the current user ID from auth
      const userId = 1; // Using a placeholder user ID
      const response = await fetch(`/api/users/${userId}/participating-events`);
      if (!response.ok) {
        throw new Error('Failed to fetch participating events');
      }
      return response.json();
    }
  });

  function formatEventDate(startTime: string, endTime: string) {
    const start = new Date(startTime);
    const formattedDate = start.toLocaleDateString();
    return formattedDate;
  }
  
  const renderEventCard = (event: Event) => (
    <Card key={event.id} className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row">
          {/* Event image/placeholder */}
          <div className="bg-muted w-full sm:w-1/3 h-32 sm:h-auto">
            <div className="w-full h-full bg-gradient-to-r from-primary/10 to-primary/30 flex justify-center items-center">
              <span className="text-sm text-muted-foreground">
                {event.category}
              </span>
            </div>
          </div>
          
          {/* Event details */}
          <div className="p-4 w-full sm:w-2/3">
            <h3 className="font-semibold truncate">{event.title}</h3>
            
            <div className="mt-2 text-sm text-muted-foreground">
              <p className="line-clamp-2">{event.description}</p>
            </div>
            
            <div className="mt-4 flex flex-col sm:flex-row sm:justify-between gap-2">
              <div className="flex items-center text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 mr-1" />
                <span className="truncate">
                  {event.latitude && event.longitude 
                    ? `${event.latitude.toFixed(3)}, ${event.longitude.toFixed(3)}`
                    : "Location not specified"}
                </span>
              </div>
              
              <div className="flex items-center text-xs text-muted-foreground">
                <Calendar className="h-3 w-3 mr-1" />
                <span>
                  {event.startTime && event.endTime 
                    ? formatEventDate(event.startTime, event.endTime)
                    : "Date not specified"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderSkeletonLoader = () => (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <Card key={i} className="animate-pulse">
          <CardContent className="p-6">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-32 bg-muted rounded mt-4"></div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">My Events</h1>

      <Tabs defaultValue="hosting">
        <TabsList className="w-full">
          <TabsTrigger value="hosting" className="flex-1">
            Hosting
          </TabsTrigger>
          <TabsTrigger value="participating" className="flex-1">
            Participating
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hosting" className="mt-6">
          {isLoadingHosted ? (
            renderSkeletonLoader()
          ) : hostedEvents && hostedEvents.length > 0 ? (
            <div className="space-y-4">
              {hostedEvents.map(renderEventCard)}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>You are not hosting any events yet.</p>
              <p className="mt-2 text-sm">Create an event to see it here.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="participating" className="mt-6">
          {isLoadingParticipating ? (
            renderSkeletonLoader()
          ) : participatingEvents && participatingEvents.length > 0 ? (
            <div className="space-y-4">
              {participatingEvents.map(renderEventCard)}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>You are not participating in any events yet.</p>
              <p className="mt-2 text-sm">Find events to participate in.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
