import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { apiRequest } from '@/lib/queryClient';
import AdminNav from '@/components/Layout/AdminNav';
import { useToast } from '@/hooks/use-toast';
import { Event, CATEGORIES } from '@shared/schema';
import * as z from 'zod';
import { format } from 'date-fns';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

import {
  ArrowLeft,
  Calendar,
  CalendarIcon,
  Check,
  Clock,
  Loader2,
  MapPin,
  Plus,
  Save,
  X
} from 'lucide-react';

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CategoryIcon } from '@/components/CategoryIcon';

// Fix imported icon paths
import 'leaflet/dist/leaflet.css';
import '@/components/Events/leaflet-fix.css';

// Define the form schema
const eventFormSchema = z.object({
  title: z.string()
    .min(3, { message: 'Titel moet minimaal 3 tekens bevatten' })
    .max(40, { message: 'Titel mag maximaal 40 tekens bevatten' }),
  description: z.string()
    .min(10, { message: 'Beschrijving moet minimaal 10 tekens bevatten' }),
  category: z.enum(CATEGORIES, {
    required_error: 'Selecteer een categorie',
  }),
  secondaryCategory: z.enum(CATEGORIES).optional().nullable(),
  location: z.string()
    .min(3, { message: 'Locatie moet minimaal 3 tekens bevatten' }),
  latitude: z.string(),
  longitude: z.string(),
  notificationReach: z.string().default('1'),
  startTime: z.date(),
  endTime: z.date().optional().nullable(),
  isPaid: z.boolean().default(false),
  price: z.number().optional().nullable(),
  maxParticipants: z.number().optional().nullable(),
  hostId: z.number().optional().nullable(),
  tags: z.array(z.string()).default([]),
  recurrence: z.enum(['once', 'daily', 'weekly', 'monthly']).default('once'),
});

type EventFormValues = z.infer<typeof eventFormSchema>;

const EventForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const eventId = parseInt(id || '0');
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [mapPosition, setMapPosition] = useState<[number, number]>([51.765, 5.526]);
  const [markerPosition, setMarkerPosition] = useState<[number, number] | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [users, setUsers] = useState<any[]>([]);

  // Create form
  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: '',
      description: '',
      category: CATEGORIES[0],
      secondaryCategory: null,
      location: '',
      latitude: '51.765',
      longitude: '5.526',
      notificationReach: '1',
      startTime: new Date(),
      endTime: null,
      isPaid: false,
      price: null,
      maxParticipants: null,
      hostId: null,
      tags: [],
      recurrence: 'once',
    },
  });

  // Fetch event data if editing
  const { data: event, isLoading } = useQuery<Event>({
    queryKey: ['/api/admin/events', eventId],
    queryFn: async () => {
      const response = await apiRequest(`/api/admin/events/${eventId}`);
      return response;
    },
    enabled: isEditing,
  });

  // Fetch users for host selection
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await apiRequest('/api/admin/users');
        setUsers(response);
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };
    
    fetchUsers();
  }, []);

  // Populate form when event data is available
  useEffect(() => {
    if (event && isEditing) {
      setMarkerPosition([parseFloat(event.latitude), parseFloat(event.longitude)]);
      setMapPosition([parseFloat(event.latitude), parseFloat(event.longitude)]);
      
      form.reset({
        title: event.title,
        description: event.description,
        category: event.category as any,
        secondaryCategory: event.secondaryCategory as any,
        location: event.location || '',
        latitude: event.latitude?.toString() || '51.765',
        longitude: event.longitude?.toString() || '5.526',
        notificationReach: event.notificationReach?.toString() || '1',
        startTime: new Date(event.startTime),
        endTime: event.endTime ? new Date(event.endTime) : null,
        isPaid: event.isPaid || false,
        price: event.price ? parseFloat(event.price.toString()) : null,
        maxParticipants: event.maxParticipants || null,
        hostId: event.hostId,
        tags: event.tags || [],
        recurrence: event.recurrence as 'once' | 'daily' | 'weekly' | 'monthly',
      });
    }
  }, [event, isEditing, form]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: EventFormValues) => {
      return apiRequest('/api/admin/events', {
        method: 'POST',
        data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/events'] });
      toast({
        title: 'Evenement aangemaakt',
        description: 'Het evenement is succesvol aangemaakt.',
      });
      navigate('/admin/events');
    },
    onError: (error) => {
      toast({
        title: 'Fout bij aanmaken',
        description: 'Er is een fout opgetreden bij het aanmaken van het evenement.',
        variant: 'destructive',
      });
      console.error('Create error:', error);
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: EventFormValues & { id: number }) => {
      const { id, ...eventData } = data;
      return apiRequest(`/api/admin/events/${id}`, {
        method: 'PUT',
        data: eventData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/events'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/events', eventId] });
      toast({
        title: 'Evenement bijgewerkt',
        description: 'Het evenement is succesvol bijgewerkt.',
      });
      navigate(`/admin/events/${eventId}`);
    },
    onError: (error) => {
      toast({
        title: 'Fout bij bijwerken',
        description: 'Er is een fout opgetreden bij het bijwerken van het evenement.',
        variant: 'destructive',
      });
      console.error('Update error:', error);
    }
  });

  // Tag handling
  const addTag = () => {
    if (tagInput.trim() && form.getValues('tags').length < 5) {
      const currentTags = form.getValues('tags');
      if (!currentTags.includes(tagInput.trim())) {
        form.setValue('tags', [...currentTags, tagInput.trim()]);
      }
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    const currentTags = form.getValues('tags');
    form.setValue('tags', currentTags.filter(t => t !== tag));
  };

  // Map marker component
  function MapMarker() {
    const map = useMapEvents({
      click(e) {
        const { lat, lng } = e.latlng;
        setMarkerPosition([lat, lng]);
        form.setValue('latitude', lat.toString());
        form.setValue('longitude', lng.toString());
      },
    });

    return markerPosition ? (
      <Marker 
        position={markerPosition} 
        icon={L.icon({
          iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
        })}
      />
    ) : null;
  }

  // Form submission
  const onSubmit = (data: EventFormValues) => {
    if (isEditing) {
      updateMutation.mutate({ ...data, id: eventId });
    } else {
      createMutation.mutate(data);
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
              <BreadcrumbPage>
                {isEditing ? 'Evenement Bewerken' : 'Nieuw Evenement'}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">
            {isEditing ? 'Evenement Bewerken' : 'Nieuw Evenement'}
          </h1>
          
          <Button 
            variant="outline" 
            onClick={() => navigate('/admin/events')}
            className="gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Annuleren
          </Button>
        </div>

        {isLoading && isEditing ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Basic Info */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Basis Informatie</CardTitle>
                    <CardDescription>
                      Voer de basisgegevens van het evenement in
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Titel</FormLabel>
                          <FormControl>
                            <Input placeholder="Voer een titel in" {...field} />
                          </FormControl>
                          <FormDescription>
                            Geef een duidelijke titel (max. 40 tekens)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Hoofdcategorie</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecteer een categorie" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {CATEGORIES.map((category) => (
                                  <SelectItem key={category} value={category}>
                                    <div className="flex items-center gap-2">
                                      <CategoryIcon category={category as any} size={16} />
                                      <span>{category}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="secondaryCategory"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Secundaire Categorie (optioneel)</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value || undefined}
                              value={field.value || undefined}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecteer een categorie" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="">Geen</SelectItem>
                                {CATEGORIES.map((category) => (
                                  <SelectItem key={category} value={category}>
                                    <div className="flex items-center gap-2">
                                      <CategoryIcon category={category as any} size={16} />
                                      <span>{category}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Beschrijving</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Beschrijf het evenement" 
                              className="min-h-32" 
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>
                            Geef een uitgebreide beschrijving van het evenement
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div>
                      <Label>Tags</Label>
                      <div className="flex mt-1.5 mb-3">
                        <Input
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          placeholder="Voeg een tag toe"
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                          className="flex-1 mr-2"
                        />
                        <Button 
                          type="button" 
                          onClick={addTag} 
                          variant="outline"
                          disabled={form.getValues('tags').length >= 5 || !tagInput.trim()}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Toevoegen
                        </Button>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 mb-2">
                        {form.watch('tags').map((tag, index) => (
                          <Badge 
                            key={index} 
                            variant="secondary"
                            className="flex items-center gap-1 pr-1"
                          >
                            {tag}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 rounded-full"
                              onClick={() => removeTag(tag)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </Badge>
                        ))}
                        
                        {form.watch('tags').length === 0 && (
                          <p className="text-sm text-muted-foreground">
                            Geen tags toegevoegd (max. 5)
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="hostId"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Organisator</FormLabel>
                          <Select
                            onValueChange={(value) => field.onChange(parseInt(value))}
                            defaultValue={field.value?.toString()}
                            value={field.value?.toString()}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecteer een organisator" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {users.map((user) => (
                                <SelectItem key={user.id} value={user.id.toString()}>
                                  {user.username}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Selecteer de gebruiker die dit evenement organiseert
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
                
                {/* Date and Time */}
                <Card>
                  <CardHeader>
                    <CardTitle>Datum en Tijd</CardTitle>
                    <CardDescription>
                      Stel in wanneer het evenement plaatsvindt
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="startTime"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Start Datum/Tijd</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className="pl-3 text-left font-normal flex justify-between items-center"
                                >
                                  {field.value ? (
                                    format(field.value, "d MMMM yyyy, HH:mm")
                                  ) : (
                                    <span>Selecteer datum/tijd</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              {/* Add date picker calendar here */}
                              <div className="p-3">
                                <p className="text-sm text-muted-foreground">
                                  Datepicker component hier
                                </p>
                              </div>
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="endTime"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Eind Datum/Tijd (optioneel)</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className="pl-3 text-left font-normal flex justify-between items-center"
                                >
                                  {field.value ? (
                                    format(field.value, "d MMMM yyyy, HH:mm")
                                  ) : (
                                    <span>Selecteer datum/tijd</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              {/* Add date picker calendar here */}
                              <div className="p-3">
                                <p className="text-sm text-muted-foreground">
                                  Datepicker component hier
                                </p>
                              </div>
                            </PopoverContent>
                          </Popover>
                          <FormDescription>
                            Laat leeg als het evenement geen eindtijd heeft
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="recurrence"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Herhaling</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecteer herhaling" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="once">Eenmalig</SelectItem>
                              <SelectItem value="daily">Dagelijks</SelectItem>
                              <SelectItem value="weekly">Wekelijks</SelectItem>
                              <SelectItem value="monthly">Maandelijks</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
                
                {/* Location Card */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Locatie</CardTitle>
                    <CardDescription>
                      Stel in waar het evenement plaatsvindt
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Locatie Naam</FormLabel>
                          <FormControl>
                            <Input placeholder="Bijv. Stadspark, Theater De Lievekamp" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="latitude"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Breedtegraad</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="longitude"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Lengtegraad</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="mt-2">
                      <p className="text-sm mb-2">Klik op de kaart om de locatie te kiezen</p>
                      <div className="h-64 rounded-md overflow-hidden border">
                        <MapContainer
                          center={mapPosition}
                          zoom={13}
                          style={{ height: '100%', width: '100%' }}
                        >
                          <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                          />
                          <MapMarker />
                        </MapContainer>
                      </div>
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="notificationReach"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notificatie Bereik (km)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="0.1" 
                              max="50" 
                              step="0.1" 
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>
                            Gebruikers binnen deze afstand krijgen een notificatie over het evenement
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
                
                {/* Extra Information */}
                <Card>
                  <CardHeader>
                    <CardTitle>Extra Informatie</CardTitle>
                    <CardDescription>
                      Aanvullende details over het evenement
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="isPaid"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Betaald Evenement</FormLabel>
                            <FormDescription>
                              Is dit een betaald evenement?
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                    
                    {form.watch('isPaid') && (
                      <FormField
                        control={form.control}
                        name="price"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Prijs (€)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min="0.01" 
                                step="0.01" 
                                placeholder="0.00"
                                {...field}
                                value={field.value === null ? '' : field.value}
                                onChange={(e) => {
                                  const value = e.target.value === '' 
                                    ? null 
                                    : parseFloat(e.target.value);
                                  field.onChange(value);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    
                    <FormField
                      control={form.control}
                      name="maxParticipants"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max. Aantal Deelnemers</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="1" 
                              placeholder="Onbeperkt"
                              {...field}
                              value={field.value === null ? '' : field.value}
                              onChange={(e) => {
                                const value = e.target.value === '' 
                                  ? null 
                                  : parseInt(e.target.value);
                                field.onChange(value);
                              }}
                            />
                          </FormControl>
                          <FormDescription>
                            Laat leeg voor onbeperkt aantal deelnemers
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </div>
              
              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/admin/events')}
                >
                  Annuleren
                </Button>
                <Button 
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="gap-1"
                >
                  {(createMutation.isPending || updateMutation.isPending) ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isEditing ? 'Bijwerken...' : 'Aanmaken...'}
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-1" />
                      {isEditing ? 'Evenement Bijwerken' : 'Evenement Aanmaken'}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </div>
    </div>
  );
};

export default EventForm;