
import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Event } from '@shared/schema';
import { EventForm } from '@/components/Events/EventForm';

export default function EditEventPage() {
  const [_, navigate] = useLocation();
  const { eventId } = useParams();
  const { toast } = useToast();
  const [formData, setFormData] = useState<Partial<Event> | null>(null);

  const { data: event, isLoading: isEventLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: async () => {
      const response = await fetch(`/api/events/${eventId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch event');
      }
      return response.json();
    },
    enabled: !!eventId,
    onSuccess: (data) => {
      setFormData(data);
    }
  });

  const updateEventMutation = useMutation({
    mutationFn: async (updatedEvent: Partial<Event>) => {
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedEvent),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update event');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Event updated',
        description: 'Your event has been updated successfully',
      });
      navigate('/'); // Navigate back to home
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to update event: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    }
  });

  const handleSubmit = (data: Partial<Event>) => {
    updateEventMutation.mutate(data);
  };

  if (isEventLoading) {
    return (
      <div className="p-6">
        <Card className="w-full max-w-4xl mx-auto animate-pulse">
          <CardHeader>
            <CardTitle className="bg-muted h-6 rounded w-1/3"></CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="h-10 bg-muted rounded"></div>
              <div className="h-24 bg-muted rounded"></div>
              <div className="h-10 bg-muted rounded"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="p-6">
        <Card className="w-full max-w-4xl mx-auto">
          <CardContent className="p-6">
            <p className="text-center">Event not found or you don't have permission to edit it</p>
            <Button 
              onClick={() => navigate('/')}
              className="mt-4 mx-auto block"
            >
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Edit Event</CardTitle>
        </CardHeader>
        <CardContent>
          {formData && (
            <EventForm 
              defaultValues={formData}
              onSubmit={handleSubmit}
              submitButtonText="Update Event"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
