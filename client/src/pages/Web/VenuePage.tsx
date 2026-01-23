import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  MapPin, 
  Globe, 
  Mail, 
  Phone, 
  Calendar,
  ArrowLeft,
  ExternalLink,
  Clock,
  Users
} from 'lucide-react';
import type { Venue, EventInterface } from '@shared/schema';
import { formatEventTimeRange } from '@/utils/date-utils';

function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('nl-NL', { 
    weekday: 'short',
    day: 'numeric', 
    month: 'short',
    year: 'numeric'
  });
}


export default function VenuePage() {
  const params = useParams();
  const venueId = params.id ? parseInt(params.id) : null;

  const { data: venue, isLoading: venueLoading } = useQuery<Venue>({
    queryKey: ['/api/venues', venueId],
    enabled: venueId !== null,
  });

  const { data: events = [], isLoading: eventsLoading } = useQuery<EventInterface[]>({
    queryKey: ['/api/venues', venueId, 'events'],
    enabled: venueId !== null,
  });

  if (venueLoading) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-64 w-full mb-6" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!venue) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4 text-center">
        <h1 className="text-2xl font-bold mb-4">Venue niet gevonden</h1>
        <Link href="/">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Terug naar home
          </Button>
        </Link>
      </div>
    );
  }

  const upcomingEvents = events.filter(e => new Date(e.startTime) >= new Date());
  const pastEvents = events.filter(e => new Date(e.startTime) < new Date());

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Terug
          </Button>
        </Link>

        {/* Venue Header */}
        <div className="relative">
          {venue.imageUrl && (
            <div className="w-full h-48 md:h-64 rounded-xl overflow-hidden mb-6">
              <img 
                src={venue.imageUrl} 
                alt={venue.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl md:text-3xl">{venue.name}</CardTitle>
                  {venue.city && (
                    <CardDescription className="flex items-center gap-1 mt-2">
                      <MapPin className="h-4 w-4" />
                      {venue.address ? `${venue.address}, ${venue.city}` : venue.city}
                    </CardDescription>
                  )}
                </div>
                {venue.isVerified && (
                  <Badge variant="default" className="bg-green-500">Geverifieerd</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {venue.description && (
                <p className="text-muted-foreground mb-4">{venue.description}</p>
              )}
              
              <div className="flex flex-wrap gap-4">
                {venue.websiteUrl && (
                  <a 
                    href={venue.websiteUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <Globe className="h-4 w-4" />
                    Website
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {venue.contactEmail && (
                  <a 
                    href={`mailto:${venue.contactEmail}`}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
                  >
                    <Mail className="h-4 w-4" />
                    {venue.contactEmail}
                  </a>
                )}
                {venue.contactPhone && (
                  <a 
                    href={`tel:${venue.contactPhone}`}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
                  >
                    <Phone className="h-4 w-4" />
                    {venue.contactPhone}
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Events */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Aankomende evenementen
            {upcomingEvents.length > 0 && (
              <Badge variant="secondary">{upcomingEvents.length}</Badge>
            )}
          </h2>
          
          {eventsLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : upcomingEvents.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Geen aankomende evenementen gepland
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {upcomingEvents.map((event) => (
                <Link key={event.id} href={`/events/${event.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        {event.imageUrl && (
                          <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
                            <img 
                              src={event.imageUrl} 
                              alt={event.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">{event.title}</h3>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(event.startTime)}
                            {(() => {
                              const timeRange = formatEventTimeRange(event.startTime, event.endTime);
                              return timeRange ? (
                                <>
                                  <Clock className="h-3 w-3 ml-2" />
                                  {timeRange}
                                </>
                              ) : null;
                            })()}
                          </div>
                          {event.category && (
                            <Badge variant="outline" className="mt-2 text-xs">
                              {event.category}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Past Events */}
        {pastEvents.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-muted-foreground">
              <Clock className="h-5 w-5" />
              Afgelopen evenementen
              <Badge variant="outline">{pastEvents.length}</Badge>
            </h2>
            
            <div className="space-y-2 opacity-75">
              {pastEvents.slice(0, 5).map((event) => (
                <Link key={event.id} href={`/events/${event.id}`}>
                  <Card className="hover:shadow-sm transition-shadow cursor-pointer">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate">{event.title}</span>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(event.startTime)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
              {pastEvents.length > 5 && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  + {pastEvents.length - 5} meer afgelopen evenementen
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
