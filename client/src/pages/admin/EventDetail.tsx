import React from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import AdminNav from '@/components/Layout/AdminNav';
import { Event } from '@shared/schema';
import { format, parseISO, isValid } from 'date-fns';
import { nl } from 'date-fns/locale';
import { CategoryIcon, getCategoryColor } from '@/components/CategoryIcon';
import { useToast } from '@/hooks/use-toast';

import {
  ArrowLeft,
  Calendar,
  Clock,
  Edit,
  Loader2,
  MapPin,
  Star,
  Tag,
  Trash2,
  Users,
  User,
} from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const EventDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const eventId = parseInt(id);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch event data
  const { data: event, isLoading, error } = useQuery<Event>({
    queryKey: ['/api/admin/events', eventId],
    queryFn: async () => {
      const response = await apiRequest(`/api/admin/events/${eventId}`);
      return response;
    },
  });

  // Fetch participants
  const { data: participants, isLoading: isLoadingParticipants } = useQuery({
    queryKey: ['/api/admin/events/participants', eventId],
    queryFn: async () => {
      const response = await apiRequest(`/api/admin/events/participants/${eventId}`);
      return response;
    },
    enabled: Boolean(eventId),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/admin/events/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/events'] });
      toast({
        title: 'Evenement verwijderd',
        description: 'Het evenement is succesvol verwijderd.',
      });
      navigate('/admin/events');
      
      // Log activity
      apiRequest('/api/admin/log-activity', {
        method: 'POST',
        data: {
          activityType: 'delete_event',
          entityId: eventId,
          entityType: 'event',
          details: { 
            title: event?.title 
          }
        }
      });
    },
    onError: (error) => {
      toast({
        title: 'Fout bij verwijderen',
        description: 'Er is een fout opgetreden bij het verwijderen van het evenement.',
        variant: 'destructive',
      });
      console.error('Delete error:', error);
    }
  });

  const handleDelete = () => {
    deleteMutation.mutate(eventId);
  };

  const formatDateTime = (dateTimeStr: string | null | undefined) => {
    if (!dateTimeStr) {
      return "Onbekende datum/tijd";
    }
    
    try {
      // Voor ISO string formaat (komt van API)
      if (typeof dateTimeStr === 'string') {
        const date = parseISO(dateTimeStr);
        if (isValid(date)) {
          return format(date, 'd MMMM yyyy, HH:mm', { locale: nl });
        }
      }
      
      // Probeer normale datum constructie
      const date = new Date(dateTimeStr);
      if (isValid(date)) {
        return format(date, 'd MMMM yyyy, HH:mm', { locale: nl });
      }
      
      return "Onbekende datum/tijd";
    } catch (e) {
      console.error("Date formatting error:", e);
      return "Onbekende datum/tijd";
    }
  };

  return (
    <div className="h-screen flex flex-col">
      <AdminNav />
      <div className="flex-1 p-6 overflow-auto">
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin/events">Evenementen</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{isLoading ? 'Laden...' : event?.title || 'Evenement'}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex items-center justify-between mb-6">
          <Button 
            variant="outline" 
            onClick={() => navigate('/admin/events')}
            className="gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Terug naar lijst
          </Button>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="gap-1"
              onClick={() => navigate(`/admin/events/edit/${eventId}`)}
            >
              <Edit className="h-4 w-4" />
              Bewerken
            </Button>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  className="gap-1"
                >
                  <Trash2 className="h-4 w-4" />
                  Verwijderen
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Weet je zeker dat je dit evenement wilt verwijderen?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Deze actie kan niet ongedaan worden gemaakt.
                    Alle gegevens van dit evenement worden permanent verwijderd.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuleren</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive hover:bg-destructive/90"
                    onClick={handleDelete}
                  >
                    {deleteMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verwijderen...
                      </>
                    ) : (
                      'Verwijderen'
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="p-6 text-center text-red-500">
            <p>Er is een fout opgetreden bij het laden van het evenement.</p>
          </div>
        ) : event ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main info */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge 
                        variant="secondary"
                        className="flex items-center gap-1"
                        style={{
                          backgroundColor: `${getCategoryColor(event.category as any)}20`,
                          color: getCategoryColor(event.category as any),
                          borderColor: `${getCategoryColor(event.category as any)}40`,
                        }}
                      >
                        <CategoryIcon 
                          category={event.category as any} 
                          size={14} 
                        />
                        {event.category}
                      </Badge>
                      
                      {event.secondaryCategory && (
                        <Badge 
                          variant="outline"
                          className="flex items-center gap-1"
                        >
                          <CategoryIcon 
                            category={event.secondaryCategory as any} 
                            size={14} 
                          />
                          {event.secondaryCategory}
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-2xl">{event.title}</CardTitle>
                    <CardDescription className="mt-1">
                      <div className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Host ID: {event.hostId}</span>
                      </div>
                    </CardDescription>
                  </div>
                  
                  {event.isPaid && (
                    <Badge variant="default" className="bg-green-600">
                      € {parseFloat((event?.price?.toString() || '0')).toFixed(2)}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Start Datum/Tijd</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(event?.startTime?.toString())}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Eind Datum/Tijd</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(event?.endTime?.toString())}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Locatie</p>
                      <p className="text-sm text-muted-foreground">
                        {event?.address || `${event?.latitude}, ${event?.longitude}`}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Max Deelnemers</p>
                      <p className="text-sm text-muted-foreground">
                        {event.maxParticipants ? `${event.maxParticipants} personen` : 'Onbeperkt'}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium mb-2">Beschrijving</h3>
                  <p className="text-muted-foreground whitespace-pre-line">
                    {event.description}
                  </p>
                </div>
                
                {event.tags && event.tags.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium mb-2">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {event.tags.map((tag, index) => (
                        <Badge 
                          key={index} 
                          variant="outline"
                          className="flex items-center gap-1"
                        >
                          <Tag className="h-3 w-3" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Participants */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Deelnemers
                </CardTitle>
                <CardDescription>
                  Mensen die deelnemen aan dit evenement
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingParticipants ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : participants && participants.length > 0 ? (
                  <div className="space-y-4">
                    {participants.map((participant: any) => (
                      <div key={participant.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{participant.username}</p>
                            <p className="text-xs text-muted-foreground">{participant.email}</p>
                          </div>
                        </div>
                        <Badge 
                          variant={
                            participant.status === 'attended' ? 'default' : 
                            participant.status === 'registered' ? 'outline' : 
                            'secondary'
                          }
                        >
                          {participant.status === 'attended' ? 'Aanwezig' :
                           participant.status === 'registered' ? 'Geregistreerd' :
                           'Geannuleerd'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p>Geen deelnemers</p>
                    <p className="text-sm">Niemand heeft zich aangemeld voor dit evenement</p>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Location Map Card */}
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Locatie op Kaart
                </CardTitle>
              </CardHeader>
              <CardContent className="h-80 bg-muted rounded-md flex items-center justify-center">
                {event?.latitude && event?.longitude && !isNaN(Number(event.latitude)) && !isNaN(Number(event.longitude)) ? (
                  <iframe
                    title="Event Location"
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(event.longitude) - 0.01},${Number(event.latitude) - 0.01},${Number(event.longitude) + 0.01},${Number(event.latitude) + 0.01}&layer=mapnik&marker=${event.latitude},${event.longitude}`}
                    style={{ borderRadius: 'inherit' }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">Geen locatie beschikbaar</p>
                  </div>
                )}
              </CardContent>
              <CardFooter className="justify-end">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        disabled={!event?.latitude || !event?.longitude}
                        onClick={() => event?.latitude && event?.longitude && window.open(`https://www.openstreetmap.org/?mlat=${event.latitude}&mlon=${event.longitude}#map=15/${event.latitude}/${event.longitude}`, '_blank')}
                      >
                        Bekijk op OpenStreetMap
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Open de locatie in een nieuw tabblad</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardFooter>
            </Card>
          </div>
        ) : (
          <div className="text-center py-12">
            <p>Evenement niet gevonden</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventDetailPage;