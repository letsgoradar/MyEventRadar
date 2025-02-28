import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Event } from '@shared/schema';
import EventCard from './EventCard';
import { Card, CardContent } from '@/components/ui/card';
import { Pencil, Trash2, Heart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useNavigate } from 'wouter';

export default function MyEvents() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [deleteEventId, setDeleteEventId] = useState<number | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data: events, isLoading, error, refetch } = useQuery<Event[]>({
    queryKey: ['my-events'],
    queryFn: async () => {
      const response = await fetch('/api/events/my-events');
      if (!response.ok) {
        throw new Error('Failed to fetch your events');
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
    return <div className="p-4 text-red-500">Error loading your events. Please try again.</div>;
  }

  const handleEditEvent = (eventId: number) => {
    navigate(`/edit-event/${eventId}`);
  };

  const confirmDelete = (eventId: number) => {
    setDeleteEventId(eventId);
    setShowDeleteDialog(true);
  };

  const handleDeleteEvent = async () => {
    if (!deleteEventId) return;

    try {
      const response = await fetch(`/api/events/${deleteEventId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: "Event deleted",
          description: "Your event was successfully deleted",
          variant: "default",
        });
        refetch();
      } else {
        throw new Error('Failed to delete event');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete event",
        variant: "destructive",
      });
    } finally {
      setShowDeleteDialog(false);
      setDeleteEventId(null);
    }
  };

  return (
    <div className="p-4 overflow-auto max-h-[calc(100vh-10rem)]">
      <h2 className="text-xl font-semibold mb-4">My Events</h2>

      {events && events.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {events.map((event) => (
            <div key={event.id} className="relative">
              <EventCard 
                event={event} 
                distance={0}
                actionButtons={
                  <div className="flex gap-2 absolute top-3 right-3 z-10">
                    <button
                      onClick={() => handleEditEvent(event.id)}
                      className="p-1.5 bg-white/90 hover:bg-white rounded-full shadow-sm"
                    >
                      <Pencil className="h-4 w-4 text-blue-500" />
                    </button>
                    <button
                      onClick={() => confirmDelete(event.id)}
                      className="p-1.5 bg-white/90 hover:bg-white rounded-full shadow-sm"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </button>
                  </div>
                }
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          You haven't created any events yet.
        </div>
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your event.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEvent} className="bg-red-500 text-white hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}