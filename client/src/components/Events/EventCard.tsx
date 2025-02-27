import React from "react";
import { Event } from "@shared/schema";
import { formatDate } from "@/lib/utils";
import { MapPin, Clock, Calendar } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

interface EventCardProps {
  event: Event;
  distance: number;
}

export default function EventCard({ event, distance }: EventCardProps) {
  const categoryColor = getCategoryColor(event.category);

  return (
    <Card className="overflow-hidden h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <Badge variant="outline" style={{ backgroundColor: categoryColor, color: 'white' }} className="mb-2">
            {event.category}
          </Badge>
          <Badge variant="outline" className="bg-muted text-foreground">
            {distance} km
          </Badge>
        </div>
        <CardTitle className="text-lg md:text-xl line-clamp-2">{event.title}</CardTitle>
        <CardDescription className="flex items-center gap-1 text-xs">
          <MapPin size={14} />
          {event.latitude.toFixed(3)}, {event.longitude.toFixed(3)}
        </CardDescription>
      </CardHeader>

      <CardContent className="pb-2 flex-grow">
        <p className="text-sm line-clamp-3 mb-2">{event.description}</p>
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar size={14} />
            {formatDate(event.startTime, "d MMMM yyyy")}
          </div>
          <div className="flex items-center gap-1">
            <Clock size={14} />
            {formatDate(event.startTime, "HH:mm")} - {formatDate(event.endTime, "HH:mm")}
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-2">
        <Link href={`/events/${event.id}`}>
          <Button className="w-full" variant="default" size="sm">
            Bekijken
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    "festival": "#ff6b6b",
    "music": "#5f3dc4",
    "sports": "#4c6ef5",
    "food": "#f59f00",
    "culture": "#da77f2",
    "educational": "#20c997",
    "networking": "#15aabf",
    "other": "#868e96"
  };

  return colors[category] || colors["other"];
}