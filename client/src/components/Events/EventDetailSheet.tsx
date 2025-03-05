import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Euro,
  Tag as CategoryIcon,
  ChevronLeft,
  ChevronRight,
  Edit,
  Trash2,
} from "lucide-react";
import type { Event } from "@shared/schema";
import { calculateDistance } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface EventDetailSheetProps {
  eventId: number | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  userLocation?: { lat: number; lng: number };
  onNavigateEvent?: (direction: 'next' | 'prev') => void;
  hasNextEvent?: boolean;
  hasPrevEvent?: boolean;
  isInSearchResults?: boolean;
}

export function EventDetailSheet({
  eventId,
  isOpen,
  onOpenChange,
  userLocation,
  onNavigateEvent,
  hasNextEvent,
  hasPrevEvent,
  isInSearchResults,
}: EventDetailSheetProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: event, isLoading } = useQuery({
    queryKey: ['/api/events', eventId],
    queryFn: async () => {
      if (!eventId) return null;
      const response = await fetch(`/api/events/${eventId}`);
      if (!response.ok) throw new Error('Failed to fetch event');
      return response.json();
    },
    enabled: !!eventId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/events/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete event');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      onOpenChange(false);
      toast({
        title: "Event verwijderd",
        description: "Het event is succesvol verwijderd.",
      });
    },
    onError: () => {
      toast({
        title: "Fout",
        description: "Er is een fout opgetreden bij het verwijderen van het event.",
        variant: "destructive",
      });
    },
  });

  const joinMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/events/${id}/join`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to join event');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events', eventId] });
      toast({
        title: "Aangemeld",
        description: "Je bent succesvol aangemeld voor dit event.",
      });
    },
    onError: () => {
      toast({
        title: "Fout",
        description: "Er is een fout opgetreden bij het aanmelden.",
        variant: "destructive",
      });
    },
  });

  if (!event && !isLoading) return null;

  const distance = userLocation && event
    ? calculateDistance(
        userLocation.lat,
        userLocation.lng,
        Number(event.latitude),
        Number(event.longitude)
      )
    : null;

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[540px] p-0">
        {isLoading ? (
          <div className="p-6">Laden...</div>
        ) : event ? (
          <>
            <SheetHeader className="p-6 pb-4">
              <div className="flex items-center justify-between">
                <SheetTitle className="text-2xl">{event.title}</SheetTitle>
                {event.isOwnEvent && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {/* TODO: Implement edit */}}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => {
                        if (confirm('Weet je zeker dat je dit event wilt verwijderen?')) {
                          deleteMutation.mutate(event.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="outline" className="flex items-center gap-1">
                  <CategoryIcon className="h-3 w-3" />
                  {event.category}
                </Badge>
                {event.isPaid && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Euro className="h-3 w-3" />
                    €{event.price?.toFixed(2)}
                  </Badge>
                )}
                {distance && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {distance.toFixed(1)} km
                  </Badge>
                )}
              </div>
            </SheetHeader>

            <div className="px-6 space-y-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {format(new Date(event.startTime), 'PPP', { locale: nl })}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4" />
                  <span>
                    {format(new Date(event.startTime), 'HH:mm', { locale: nl })} - 
                    {format(new Date(event.endTime), 'HH:mm', { locale: nl })}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4" />
                  <span>
                    {event.participants?.length || 0} aanmeldingen
                    {event.maxParticipants && ` (max. ${event.maxParticipants})`}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium">Beschrijving</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {event.description}
                </p>
              </div>

              {!event.isOwnEvent && (
                <div className="sticky bottom-0 bg-white py-4 border-t">
                  <Button 
                    className="w-full" 
                    onClick={() => joinMutation.mutate(event.id)}
                    disabled={joinMutation.isPending}
                  >
                    {joinMutation.isPending ? 'Aanmelden...' : 'Aanmelden'}
                  </Button>
                </div>
              )}
            </div>

            {isInSearchResults && (
              <div className="absolute top-1/2 -translate-y-1/2 flex justify-between w-full px-2">
                {hasPrevEvent && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full"
                    onClick={() => onNavigateEvent?.('prev')}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                )}
                {hasNextEvent && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full ml-auto"
                    onClick={() => onNavigateEvent?.('next')}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}