import { format } from "date-fns";
import { Calendar, MapPin, Users } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Event } from "@shared/schema";

interface EventCardProps {
  event: Event;
  onSelect?: (event: Event) => void;
}

export default function EventCard({ event, onSelect }: EventCardProps) {
  const location = event.location as { lat: number; lng: number; address?: string };
  const locationText = location.address || `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`;

  return (
    <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => onSelect?.(event)}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <h3 className="text-lg font-semibold">{event.title}</h3>
          {event.isPaid && event.price && (
            <span className="text-primary font-bold">${event.price}</span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center text-gray-600">
            <MapPin className="h-4 w-4 mr-2" />
            <span className="text-sm">{locationText}</span>
          </div>

          <div className="flex items-center text-gray-600">
            <Calendar className="h-4 w-4 mr-2" />
            <span className="text-sm">
              {format(new Date(event.startTime), "MMM d, h:mm a")}
            </span>
          </div>

          {event.maxParticipants && (
            <div className="flex items-center text-gray-600">
              <Users className="h-4 w-4 mr-2" />
              <span className="text-sm">
                Max participants: {event.maxParticipants}
              </span>
            </div>
          )}

          <p className="text-sm text-gray-600 line-clamp-2 mt-2">
            {event.description}
          </p>

          <div className="pt-2">
            <Button className="w-full">View Details</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}