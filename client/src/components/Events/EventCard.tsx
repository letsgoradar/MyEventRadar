import { format } from "date-fns";
import { Calendar, MapPin, Users, Euro, Clock, Tag, RepeatIcon } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Event } from "@shared/schema";

interface EventCardProps {
  event: Event;
  onSelect?: (event: Event) => void;
}

export default function EventCard({ event, onSelect }: EventCardProps) {
  const location = event.location as { lat: number; lng: number; address?: string; notificationReach: number };
  const locationText = location.address || `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`;

  return (
    <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => onSelect?.(event)}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold">{event.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">{event.category}</Badge>
              {event.subcategory && (
                <Badge variant="outline" className="bg-slate-50">
                  {event.subcategory}
                </Badge>
              )}
            </div>
          </div>
          {event.isPaid && event.price && (
            <Badge variant="secondary" className="text-lg">
              €{event.price}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center text-gray-600">
            <MapPin className="h-4 w-4 mr-2" />
            <div>
              <span className="text-sm">{locationText}</span>
              <span className="text-sm text-gray-500 block">
                Notification radius: {location.notificationReach}km
              </span>
            </div>
          </div>

          <div className="flex items-center text-gray-600">
            <Calendar className="h-4 w-4 mr-2" />
            <div>
              <span className="text-sm">
                {format(new Date(event.startTime), "MMM d, yyyy")}
              </span>
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3" />
                <span className="text-sm">
                  {format(new Date(event.startTime), "h:mm a")}
                  {event.endTime && ` - ${format(new Date(event.endTime), "h:mm a")}`}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {event.maxParticipants > 0 && (
              <div className="flex items-center text-gray-600">
                <Users className="h-4 w-4 mr-2" />
                <span className="text-sm">
                  Max: {event.maxParticipants}
                </span>
              </div>
            )}

            <div className="flex items-center text-gray-600">
              <RepeatIcon className="h-4 w-4 mr-2" />
              <span className="text-sm capitalize">
                {event.recurrence}
              </span>
            </div>
          </div>

          <p className="text-sm text-gray-600 mt-2">
            {event.description}
          </p>

          <div className="pt-2 flex justify-end">
            <Button>View Details</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}