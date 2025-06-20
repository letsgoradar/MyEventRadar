import * as React from "react";
import { App2Layout } from "@/components/App2/App2Layout";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { EventInterface } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Heart } from "lucide-react";
import { Link } from "wouter";
import EventCard from "@/components/Events/EventCard";
import { useAuth } from "@/hooks/use-auth";

export function App2FavoritesPage() {
  const { user } = useAuth();
  
  // Query voor favoriete evenementen
  const { data: favoriteEvents = [], isLoading, error } = useQuery<EventInterface[]>({
    queryKey: ['/api/events/favorites'],
    enabled: !!user,
  });

  console.log('App2 Favorites query result:', { favoriteEvents, isLoading, error, user: !!user });

  // Loading state
  const LoadingState = () => (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3].map((n) => (
        <div key={n} className="h-32 bg-gray-200 rounded-md"></div>
      ))}
    </div>
  );

  // Empty state
  const EmptyState = () => (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-8">
        <Heart className="h-10 w-10 text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold mb-2">Geen favorieten</h2>
        <p className="text-muted-foreground mb-4 text-center">
          Je hebt nog geen evenementen als favoriet gemarkeerd.
        </p>
        <Button asChild>
          <Link href="/app2">
            Ontdek evenementen
          </Link>
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <App2Layout title="Favorieten">
      <div className="pb-20">
        
        {isLoading ? (
          <LoadingState />
        ) : favoriteEvents.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
            {favoriteEvents.map((event) => (
              <Link key={event.id} href={`/app2/event/${event.id}`} className="block">
                <EventCard event={event} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </App2Layout>
  );
}

export default App2FavoritesPage;