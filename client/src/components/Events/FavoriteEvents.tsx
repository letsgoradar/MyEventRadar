
import { useQuery } from '@tanstack/react-query';
import { Event } from '@shared/schema';
import EventCard from './EventCard';
import { Card, CardContent } from '@/components/ui/card';
import { Heart } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function FavoriteEvents() {
  const { toast } = useToast();
  
  const { data: events, isLoading, error, refetch } = useQuery<Event[]>({
    queryKey: ['favorite-events'],
    queryFn: async () => {
      const response = await fetch('/api/events/favorites');
      if (!response.ok) {
        throw new Error('Failed to fetch favorite events');
      }
      return response.json();
    }
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
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
  }

  if (error) {
    return <div className="p-4 text-red-500">Error loading your favorite events. Please try again.</div>;
  }

  return (
    <div className="p-4 overflow-auto max-h-[calc(100vh-10rem)]">
      <h2 className="text-xl font-semibold mb-4">Favorite Events</h2>
      
      {events && events.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {events.map((event) => (
            <EventCard key={event.id} event={event} distance={0} showFavoriteButton />
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          You don't have any favorite events yet.
        </div>
      )}
    </div>
  );
}
