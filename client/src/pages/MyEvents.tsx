
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Link, useLocation } from "wouter";
import type { Event } from "@shared/schema";
import { MapPin, Calendar, Pencil, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import TopNav from "@/components/Layout/TopNav";
import BottomNav from "@/components/Layout/BottomNav";

export default function MyEvents() {
  const [, navigate] = useLocation();
  const [isMapView, setIsMapView] = useState(false);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  const toggleView = () => {
    setIsMapView(!isMapView);
  };

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

  const handleEditEvent = (eventId: number) => {
    navigate(`/edit-event/${eventId}`);
  };

  const handleDeleteEvent = async (eventId: number) => {
    if (window.confirm("Weet je zeker dat je dit evenement wilt verwijderen?")) {
      try {
        const response = await fetch(`/api/events/${eventId}`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          // Refresh the data after deletion
          window.location.reload();
        } else {
          alert("Er is een fout opgetreden bij het verwijderen van het evenement.");
        }
      } catch (error) {
        console.error("Error deleting event:", error);
        alert("Er is een fout opgetreden bij het verwijderen van het evenement.");
      }
    }
  };

  const renderEventCard = (event: Event) => (
    <Card key={event.id} className="overflow-hidden">
      <CardContent className="p-0">
        <div className="p-4">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold text-lg mb-1">{event.title}</h3>
              <p className="text-muted-foreground text-sm mb-2">{event.description?.substring(0, 80)}...</p>
              <div className="flex items-center text-sm text-muted-foreground space-x-2">
                <MapPin className="h-4 w-4" />
                <span>Location details</span>
              </div>
              <div className="flex items-center text-sm text-muted-foreground mt-1 space-x-2">
                <Calendar className="h-4 w-4" />
                <span>{formatDistanceToNow(new Date(event.startTime), { addSuffix: true })}</span>
              </div>
            </div>
            <div className="flex space-x-2">
              <button 
                onClick={() => handleEditEvent(event.id)} 
                className="p-2 rounded-full bg-blue-100 hover:bg-blue-200 transition-colors"
              >
                <Pencil className="h-4 w-4 text-blue-600" />
              </button>
              <button 
                onClick={() => handleDeleteEvent(event.id)}
                className="p-2 rounded-full bg-red-100 hover:bg-red-200 transition-colors"
              >
                <Trash2 className="h-4 w-4 text-red-600" />
              </button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderSkeletonLoader = () => (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="overflow-hidden">
          <CardContent className="p-4">
            <div className="animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-2/3 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="h-screen flex flex-col relative">
      <TopNav 
        isMapView={isMapView}
        toggleView={toggleView}
        toggleFilterSheet={() => setIsFilterSheetOpen(true)}
        isFilterSheetOpen={isFilterSheetOpen}
        setIsFilterSheetOpen={setIsFilterSheetOpen}
      />
      
      <div className="flex-1 overflow-auto p-4 pb-24">
        <h1 className="text-2xl font-bold mb-6">Mijn Evenementen</h1>
        
        <Tabs defaultValue="hosted">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="hosted">Door mij gehost</TabsTrigger>
            <TabsTrigger value="participating">Deelname</TabsTrigger>
          </TabsList>
          
          <TabsContent value="hosted" className="mt-6">
            {isLoadingHosted ? (
              renderSkeletonLoader()
            ) : hostedEvents && hostedEvents.length > 0 ? (
              <div className="space-y-4">
                {hostedEvents.map(renderEventCard)}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>Je hebt nog geen evenementen gehost.</p>
                <p className="mt-2 text-sm">Maak een nieuw evenement aan.</p>
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
                <p>Je neemt nog niet deel aan evenementen.</p>
                <p className="mt-2 text-sm">Zoek evenementen om aan deel te nemen.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
      
      <BottomNav />
    </div>
  );
}
