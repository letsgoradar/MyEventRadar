import React from "react";
import { Event } from "@shared/schema";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface EventCardProps {
  event: Event & { distance?: number };
}

function EventCard({ event }: EventCardProps) {
  const formatDate = (date: Date) => {
    return format(new Date(date), "d MMM yyyy HH:mm");
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">{event.title}</CardTitle>
          {event.distance !== undefined && (
            <Badge variant="outline" className="ml-2">
              {event.distance.toFixed(1)} km
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
        <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
          {event.description}
        </p>
        <div className="flex flex-wrap gap-2 mb-2">
          <Badge variant="secondary">{event.category}</Badge>
          {event.subcategory && (
            <Badge variant="outline">{event.subcategory}</Badge>
          )}
        </div>
        <div className="text-sm mt-2">
          <div>
            <span className="font-medium">Start: </span>
            {formatDate(event.startTime)}
          </div>
          {event.endTime && (
            <div>
              <span className="font-medium">Eind: </span>
              {formatDate(event.endTime)}
            </div>
          )}
          {event.isPaid && (
            <div className="mt-1">
              <span className="font-medium">Prijs: </span>€{event.price}
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="border-t pt-4">
        <div className="w-full flex justify-between items-center">
          <Badge variant={event.isPaid ? "destructive" : "success"}>
            {event.isPaid ? "Betaald" : "Gratis"}
          </Badge>
          <span className="text-sm text-muted-foreground">
            Max: {event.maxParticipants} deelnemers
          </span>
        </div>
      </CardFooter>
    </Card>
  );
}

export default EventCard;