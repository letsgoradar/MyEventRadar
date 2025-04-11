import React, { useState, useCallback } from 'react';
import { WebLayout } from '@/components/Web/WebLayout';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocation } from '@/hooks/useLocation';
import { useLocation as useWouterLocation } from 'wouter';
import { insertEventSchema } from '@shared/schema';
import { CATEGORIES } from '@shared/schema';
import { useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { Button } from '@/components/ui/button';
import { CategoryImageSelector } from '@/components/Events/CategoryImageSelector';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, ChevronLeft, Image, MapPin, X } from 'lucide-react';
import { Link } from 'wouter';
import { DateTimePicker } from '@/components/date-time-picker';
import { useToast } from '@/hooks/use-toast';
import { generateTags, suggestCategory } from '@/lib/aiTagGenerator';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import 'leaflet/dist/leaflet.css';
import '@/components/Events/leaflet-fix.css';
import L from 'leaflet';

// Aangepast validatie schema voor het formulier
const createEventFormSchema = insertEventSchema
  .extend({
    imageFile: z.any().optional(),
    imageUrl: z.string().optional(),
    startTime: z.date().min(new Date(), { message: 'Startdatum moet in de toekomst liggen' }),
    endTime: z.date(),
    maxParticipants: z.number().nullable().optional(),
    hasMaxParticipants: z.boolean().default(false),
    latitude: z.number(),
    longitude: z.number(),
    notificationReach: z.number().default(5.0),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: 'Einddatum moet na startdatum liggen',
    path: ['endTime'],
  });

type CreateEventFormValues = z.infer<typeof createEventFormSchema>;

const LocationPicker = ({ 
  defaultPosition = [51.7767, 5.5345] as [number, number],
  onChange
}: { 
  defaultPosition?: [number, number], 
  onChange: (lat: number, lng: number) => void 
}) => {
  const [markerPosition, setMarkerPosition] = useState<[number, number]>(defaultPosition);
  
  const MapEvents = () => {
    useMapEvents({
      click(e) {
        const { lat, lng } = e.latlng;
        setMarkerPosition([lat, lng]);
        onChange(lat, lng);
      },
    });
    return null;
  };

  return (
    <div className="h-[400px] w-full rounded-md overflow-hidden">
      <MapContainer
        center={markerPosition}
        zoom={13}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
        />
        <Marker position={markerPosition} />
        <MapEvents />
      </MapContainer>
    </div>
  );
};

const CreateEvent = () => {
  const { location } = useLocation();
  const [, setLocation] = useWouterLocation();
  const { toast } = useToast();
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // Form setup
  const form = useForm<CreateEventFormValues>({
    resolver: zodResolver(createEventFormSchema),
    defaultValues: {
      title: '',
      description: '',
      category: undefined, // Geen categorie bij default
      isPaid: false,
      price: undefined,
      maxParticipants: undefined,
      hasMaxParticipants: false,
      latitude: location?.lat ?? 51.7767,
      longitude: location?.lng ?? 5.5345,
      location: {
        lat: location?.lat ?? 51.7767,
        lng: location?.lng ?? 5.5345,
        notificationReach: 5.0,
      },
      startTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
      endTime: new Date(Date.now() + 26 * 60 * 60 * 1000), // tomorrow + 2 hours
      tags: [],
      recurrence: 'once',
      notificationReach: 5.0,
    },
  });
  
  // Event creation mutation
  const createEventMutation = useMutation({
    mutationFn: async (data: CreateEventFormValues) => {
      // Verwijder image file van data voor API verzoek
      const { imageFile, ...apiData } = data;
      
      // Zorg ervoor dat numerieke velden juist worden geconverteerd
      const formattedData = {
        ...apiData,
        price: data.isPaid && data.price ? Number(data.price) : null,
        maxParticipants: data.hasMaxParticipants && data.maxParticipants ? Number(data.maxParticipants) : null,
      };
      
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formattedData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create event');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      toast({
        title: "Evenement aangemaakt",
        description: "Je evenement is succesvol aangemaakt."
      });
      setLocation('/web');
    },
    onError: (error: Error) => {
      toast({
        title: "Fout bij aanmaken evenement",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Voorspel categorie op basis van titel
  const handleTitleBlur = () => {
    const title = form.getValues('title');
    if (title && !form.getValues('category')) {
      const suggestedCategory = suggestCategory(title);
      if (suggestedCategory) {
        form.setValue('category', suggestedCategory);
      }
    }
  };
  
  // Genereer tags op basis van titel en categorie
  const generateEventTags = () => {
    const title = form.getValues('title');
    const category = form.getValues('category');
    if (title && category) {
      const suggestedTags = generateTags(title, category);
      form.setValue('tags', suggestedTags);
    }
  };
  
  // Functie om locatie te updaten
  const handleLocationChange = (lat: number, lng: number) => {
    form.setValue('latitude', lat);
    form.setValue('longitude', lng);
    // Update ook het location object voor API-compatibiliteit
    const currentLocation = form.getValues('location');
    form.setValue('location', {
      ...currentLocation,
      lat,
      lng
    });
  };
  
  // Functie om afbeelding te verwerken
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Controleer of bestand een afbeelding is
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Ongeldig bestandstype",
          description: "Alleen afbeeldingen worden ondersteund.",
          variant: "destructive"
        });
        return;
      }
      
      // Controleer bestandsgrootte (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Bestand te groot",
          description: "De afbeelding mag maximaal 5MB groot zijn.",
          variant: "destructive"
        });
        return;
      }
      
      setSelectedImage(file);
      form.setValue('imageFile', file);
      
      // Maak een preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  // Functie om een categorie-afbeelding te verwerken
  const handleCategoryImage = (imageUrl: string) => {
    setImagePreview(imageUrl);
    // We slaan de URL op in plaats van een bestand
    form.setValue('imageUrl', imageUrl);
  };
  
  // Functie om afbeelding te verwijderen
  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    form.setValue('imageFile', undefined);
    form.setValue('imageUrl', undefined);
  };
  
  // Formulier indienen
  const onSubmit = (data: CreateEventFormValues) => {
    createEventMutation.mutate(data);
  };

  return (
    <WebLayout>
      <div className="flex-1 pb-12">
        <div className="max-w-5xl mx-auto overflow-visible">
          <div className="flex items-center mb-8">
            <Button variant="ghost" asChild className="mr-4">
              <Link href="/web">
                <ChevronLeft className="mr-2 h-4 w-4" />
                Terug
              </Link>
            </Button>
            <h1 className="text-3xl font-bold">Nieuw Evenement</h1>
          </div>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Linker kolom - Afbeelding en basisgegevens */}
                <div className="md:col-span-2 space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-xl">Basisinformatie</CardTitle>
                      <CardDescription>
                        Vul de basisinformatie voor je evenement in
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* 1. Categorie selecteren */}
                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Categorie</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecteer een categorie" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {CATEGORIES.map((category) => (
                                  <SelectItem key={category} value={category}>
                                    {category}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Kies een categorie voor je evenement
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {/* 2. Titel */}
                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Titel</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Geef je evenement een titel" 
                                {...field} 
                                onBlur={handleTitleBlur}
                              />
                            </FormControl>
                            <FormDescription>
                              Een duidelijke en pakkende titel voor je evenement
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {/* 3. Omschrijving */}
                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Beschrijving</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Beschrijf wat mensen kunnen verwachten" 
                                className="min-h-[120px]"
                                {...field} 
                              />
                            </FormControl>
                            <FormDescription>
                              Geef gedetailleerde informatie over je evenement
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {/* 4. Afbeelding met navigatie */}
                      <div className="space-y-2">
                        <FormLabel>Afbeelding</FormLabel>
                        <FormDescription>
                          We selecteren automatisch een relevante afbeelding op basis van de categorie
                        </FormDescription>
                        
                        {imagePreview ? (
                          <div className="relative h-60 w-full rounded-md overflow-hidden">
                            <img 
                              src={imagePreview} 
                              alt="Event preview" 
                              className="w-full h-full object-cover"
                            />
                            <button 
                              type="button"
                              className="absolute top-2 right-2 bg-red-500 hover:bg-red-700 text-white p-1 rounded-full"
                              onClick={removeImage}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <CategoryImageSelector
                            title={form.watch('title') || ''}
                            category={form.watch('category') || null}
                            onImageSelected={handleCategoryImage}
                            onUploadClick={() => document.getElementById('image-upload')?.click()}
                          />
                        )}
                        
                        {/* 5. Optie voor eigen afbeelding upload */}
                        <input
                          id="image-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageChange}
                        />
                      </div>
                      
                      {/* 6. Betaald event ja/nee */}
                      <FormField
                        control={form.control}
                        name="isPaid"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Betaald evenement</FormLabel>
                              <FormDescription>
                                Zet dit aan als deelnemers moeten betalen
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      
                      {/* Toon prijsveld indien betaald event */}
                      {form.watch('isPaid') && (
                        <FormField
                          control={form.control}
                          name="price"
                          render={({ field: { value, onChange, ...fieldProps } }) => (
                            <FormItem>
                              <FormLabel>Prijs (EUR)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  placeholder="0.00"
                                  value={value === undefined || value === null ? "" : value}
                                  onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
                                  {...fieldProps}
                                />
                              </FormControl>
                              <FormDescription>
                                De prijs per deelnemer in euro's
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                      
                      {/* 7. Deelnemers: maximum ja/nee */}
                      <FormField
                        control={form.control}
                        name="hasMaxParticipants"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Maximum aantal deelnemers</FormLabel>
                              <FormDescription>
                                Stel een maximum in voor het aantal deelnemers
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      
                      {/* Toon maximaal deelnemersveld indien nodig */}
                      {form.watch('hasMaxParticipants') && (
                        <FormField
                          control={form.control}
                          name="maxParticipants"
                          render={({ field: { value, onChange, ...fieldProps } }) => (
                            <FormItem>
                              <FormLabel>Maximum aantal deelnemers</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min={1}
                                  placeholder="Aantal deelnemers" 
                                  value={value === undefined || value === null ? "" : value}
                                  onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
                                  {...fieldProps} 
                                />
                              </FormControl>
                              <FormDescription>
                                Geef aan hoeveel mensen maximaal kunnen deelnemen
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </CardContent>
                  </Card>
                </div>
                
                {/* Rechter kolom - Locatie, datum en tijd */}
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-xl">Datum en tijd</CardTitle>
                      <CardDescription>
                        Wanneer vindt het evenement plaats?
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="startTime"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Startdatum en -tijd</FormLabel>
                            <DateTimePicker
                              date={field.value}
                              setDate={field.onChange}
                            />
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="endTime"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Einddatum en -tijd</FormLabel>
                            <DateTimePicker
                              date={field.value}
                              setDate={field.onChange}
                            />
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-xl">Locatie</CardTitle>
                      <CardDescription>
                        Klik op de kaart om de locatie te kiezen
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <LocationPicker 
                        defaultPosition={[
                          form.getValues('latitude') || 51.7767, 
                          form.getValues('longitude') || 5.5345
                        ]}
                        onChange={handleLocationChange}
                      />
                      <div className="flex items-center mt-4 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4 mr-2" />
                        <span>
                          Lat: {form.getValues('latitude')?.toFixed(6) || '51.7767'}, 
                          Lng: {form.getValues('longitude')?.toFixed(6) || '5.5345'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex justify-between items-center">
                        <span className="text-xl">Tags</span>
                        <Button 
                          variant="outline" 
                          size="sm"
                          type="button"
                          onClick={generateEventTags}
                        >
                          Genereer tags
                        </Button>
                      </CardTitle>
                      <CardDescription>
                        Tags helpen je evenement vindbaar te maken
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <FormField
                        control={form.control}
                        name="tags"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input 
                                placeholder="Voeg tags toe, gescheiden door komma's" 
                                value={field.value.join(', ')}
                                onChange={(e) => {
                                  const tagsArray = e.target.value
                                    .split(',')
                                    .map(tag => tag.trim())
                                    .filter(tag => tag.length > 0);
                                  field.onChange(tagsArray);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                </div>
              </div>
              
              <div className="flex justify-end gap-4">
                <Button variant="outline" asChild>
                  <Link href="/web">Annuleren</Link>
                </Button>
                <Button 
                  type="submit" 
                  disabled={createEventMutation.isPending}
                >
                  {createEventMutation.isPending ? 'Bezig met opslaan...' : 'Evenement aanmaken'}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </WebLayout>
  );
};

export default CreateEvent;