import * as React from "react";
import { App2Layout } from "@/components/App2/App2Layout";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { Event } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AlertCircle, Plus } from "lucide-react";
import { Link } from "wouter";
import EventCard from "@/components/Events/EventCard";

export function App2EventsPage() {
  // Queries voor verschillende categorieën evenementen
  const { data: hostedEvents = [], isLoading: isLoadingHosted } = useQuery<Event[]>({
    queryKey: ['/api/events/hosted'],
  });

  const { data: joinedEvents = [], isLoading: isLoadingJoined } = useQuery<Event[]>({
    queryKey: ['/api/events/joined'],
  });

  // Loading states
  const LoadingState = () => (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3].map((n) => (
        <div key={n} className="h-32 bg-gray-200 rounded-md"></div>
      ))}
    </div>
  );

  // Empty state
  const EmptyState = ({ type, create = false }: { type: string; create?: boolean }) => (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-8">
        <AlertCircle className="h-10 w-10 text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold mb-2">Geen evenementen</h2>
        <p className="text-muted-foreground mb-4 text-center">
          {type === "hosted" 
            ? "Je hebt nog geen evenementen aangemaakt." 
            : "Je neemt nog niet deel aan evenementen."}
        </p>
        {create && (
          <Button asChild>
            <Link href="/app2/create-event">
              <Plus className="mr-2 h-4 w-4" />
              Maak een evenement
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );

  return (
    <App2Layout>
      <div className="p-4 pb-20">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Mijn Evenementen</h1>
          <Button size="sm" asChild>
            <Link href="/app2/create-event">
              <Plus className="mr-1 h-4 w-4" />
              Nieuw
            </Link>
          </Button>
        </div>

        <Tabs defaultValue="hosting">
          <TabsList className="w-full mb-4">
            <TabsTrigger value="hosting" className="flex-1">Organiseren</TabsTrigger>
            <TabsTrigger value="attending" className="flex-1">Deelnemen</TabsTrigger>
          </TabsList>
          
          <TabsContent value="hosting" className="space-y-4">
            {isLoadingHosted ? (
              <LoadingState />
            ) : hostedEvents.length === 0 ? (
              <EmptyState type="hosted" create={true} />
            ) : (
              <div className="space-y-4">
                {hostedEvents.map((event) => (
                  <Link key={event.id} href={`/app2/event/${event.id}`}>
                    <a className="block">
                      <EventCard event={event} />
                    </a>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="attending" className="space-y-4">
            {isLoadingJoined ? (
              <LoadingState />
            ) : joinedEvents.length === 0 ? (
              <EmptyState type="joined" />
            ) : (
              <div className="space-y-4">
                {joinedEvents.map((event) => (
                  <Link key={event.id} href={`/app2/event/${event.id}`}>
                    <a className="block">
                      <EventCard event={event} />
                    </a>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </App2Layout>
  );
}

export default App2EventsPage;