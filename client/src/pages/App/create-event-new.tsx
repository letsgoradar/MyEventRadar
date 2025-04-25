import React, { useState, useCallback, useEffect } from 'react';
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
import { ImageGenerator } from '@/components/Events/ImageGenerator';
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
import { Calendar, ChevronLeft, Image, MapPin, X, Plus } from 'lucide-react';
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
    imageUrl: z.string().optional(), // Toegevoegd voor AI gegenereerde afbeeldingen
    startTime: z.date().min(new Date(), { message: 'Startdatum moet in de toekomst liggen' }),
    endTime: z.date(),
    maxParticipants: z.number().nullable().optional(),
    hasMaxParticipants: z.boolean().default(false),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: 'Einddatum moet na startdatum liggen',
    path: ['endTime'],
  })
  .refine((data) => !!data.imageFile || !!data.imageUrl, {
    message: 'Een afbeelding is verplicht. Upload een eigen afbeelding of genereer er een.',
    path: ['imageFile'],
  });

type CreateEventFormValues = z.infer<typeof createEventFormSchema>;

const LocationPicker = ({ 
  defaultPosition = [51.7767, 5.5345] as [number, number],
  onChange
}: { 
  defaultPosition?: [number, number], 
  onChange: (lat: number, lng: number) => void 
}) => {
  // Zorg ervoor dat we altijd geldige coördinaten gebruiken
  const validDefaultPosition: [number, number] = Array.isArray(defaultPosition) && 
    defaultPosition.length === 2 && 
    typeof defaultPosition[0] === 'number' && 
    typeof defaultPosition[1] === 'number' ? 
    defaultPosition : [51.7767, 5.5345];
  
  const [markerPosition, setMarkerPosition] = useState<[number, number]>(validDefaultPosition);
  
  // Roep onChange aan bij initialisatie
  // We maken gebruik van React.useEffect om zeker te zijn dat het geïmporteerd is
  React.useEffect(() => {
    onChange(validDefaultPosition[0], validDefaultPosition[1]);
  }, []);
  
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

export function AppCreateEventNew() {
  const { location } = useLocation();
  const [, setLocation] = useWouterLocation();
  const { toast } = useToast();
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  
  // Form setup
  const form = useForm<CreateEventFormValues>({
    resolver: zodResolver(createEventFormSchema),
    defaultValues: {
      title: '',
      description: '',
      category: 'Gezellig en Sociaal',
      isPaid: false,
      price: undefined,
      maxParticipants: undefined,
      hasMaxParticipants: false,
      location: {
        lat: location?.lat ?? 51.7767,
        lng: location?.lng ?? 5.5345,
        notificationReach: 5.0,
      },
      startTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
      endTime: new Date(Date.now() + 26 * 60 * 60 * 1000), // tomorrow + 2 hours
      tags: [],
      recurrence: 'once',
    },
  });
  
  // Event creation mutation
  const createEventMutation = useMutation({
    mutationFn: async (data: any) => { // We gebruiken 'any' voor type flexibiliteit
      console.log("Data ontvangen in mutatiefunctie:", data);
      
      // Verwijder image file van data voor API verzoek, maar behoud imageUrl
      const { imageFile, hasMaxParticipants, ...apiData } = data;
      
      // Zorg ervoor dat numerieke velden juist worden geconverteerd
      // En voeg ontbrekende verplichte velden toe als ze ontbreken
      const formattedData = {
        ...apiData,
        hostId: data.hostId || 1, // Gebruik hostId als het aanwezig is, anders gebruik de standaardwaarde
        tags: data.tags || [], // Zorg dat tags altijd een array is
        price: data.isPaid && data.price ? Number(data.price) : null,
        // Zorg dat maxParticipants altijd een nummer is (0 indien niet ingesteld)
        maxParticipants: data.hasMaxParticipants && data.maxParticipants ? Number(data.maxParticipants) : 0,
        // Voeg de imageUrl toe voor het geval het een gegenereerde afbeelding is
        imageUrl: data.imageUrl || null,
      };
      
      console.log('Versturen van evenement data:', formattedData);
      
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
      setLocation('/app');
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
    // Update het locatie-object met nieuwe coördinaten
    const currentLocation = form.getValues('location') || {};
    form.setValue('location', { 
      ...currentLocation, 
      lat, 
      lng,
      notificationReach: currentLocation.notificationReach || 5.0
    });
  };
  
  // Maximaal aantal toegestane afbeeldingen
  const MAX_IMAGES = 5;

  // Functie om afbeelding te resizen en verwerken
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      // Check of we het maximum aantal afbeeldingen niet overschrijden
      if (imagePreviews.length + e.target.files.length > MAX_IMAGES) {
        toast({
          title: "Te veel afbeeldingen",
          description: `Je kunt maximaal ${MAX_IMAGES} afbeeldingen uploaden.`,
          variant: "destructive"
        });
        return;
      }
      
      // Loop door alle geselecteerde bestanden
      Array.from(e.target.files).forEach((file) => {
        // Controleer of bestand een afbeelding is
        if (!file.type.startsWith('image/')) {
          toast({
            title: "Ongeldig bestandstype",
            description: "Alleen afbeeldingen worden ondersteund.",
            variant: "destructive"
          });
          return;
        }
        
        // Eerste validatie van bestandsgrootte
        if (file.size > 10 * 1024 * 1024) { // 10MB als initiële check
          toast({
            title: "Bestand te groot",
            description: "De afbeelding mag maximaal 10MB groot zijn.",
            variant: "destructive"
          });
          return;
        }
        
        // Toon een laadbericht
        toast({
          title: "Afbeelding optimaliseren",
          description: "De afbeelding wordt geoptimaliseerd...",
        });
        
        // Maak een afbeeldingselement aan om te gebruiken voor resizing
        const img = document.createElement('img');
        const reader = new FileReader();
        
        reader.onload = (readerEvent) => {
          if (!readerEvent.target || typeof readerEvent.target.result !== 'string') {
            return;
          }
          
          img.onload = () => {
            // Bepaal de grootte om naar te resizen
            // Behoud de aspect ratio, maar beperk de max dimensie tot 1200px
            const MAX_WIDTH = 1200;
            const MAX_HEIGHT = 1200;
            let width = img.width;
            let height = img.height;
            
            // Bereken nieuwe dimensies
            if (width > height) {
              if (width > MAX_WIDTH) {
                height = Math.round(height * (MAX_WIDTH / width));
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width = Math.round(width * (MAX_HEIGHT / height));
                height = MAX_HEIGHT;
              }
            }
            
            // Maak een canvas aan om de afbeelding te resizen
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            
            // Teken de afbeelding op het canvas
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              toast({
                title: "Fout bij optimaliseren",
                description: "Er is een probleem opgetreden bij het optimaliseren van de afbeelding.",
                variant: "destructive"
              });
              return;
            }
            
            ctx.drawImage(img, 0, 0, width, height);
            
            // Converteer naar JPEG met 85% kwaliteit voor een goede balans
            const optimizedImageUrl = canvas.toDataURL('image/jpeg', 0.85);
            
            // Voeg deze toe aan de previews
            setImagePreviews(prev => [...prev, optimizedImageUrl]);
            
            // Converteer data URL naar Blob/File voor opslag
            const byteString = atob(optimizedImageUrl.split(',')[1]);
            const mimeString = optimizedImageUrl.split(',')[0].split(':')[1].split(';')[0];
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            
            for (let i = 0; i < byteString.length; i++) {
              ia[i] = byteString.charCodeAt(i);
            }
            
            const optimizedBlob = new Blob([ab], { type: mimeString });
            const optimizedFile = new File([optimizedBlob], file.name, { type: 'image/jpeg' });
            
            // Voeg toe aan geselecteerde afbeeldingen
            setSelectedImages(prev => [...prev, optimizedFile]);
            
            // Update het formulier met de eerste afbeelding als hoofdafbeelding
            if (imagePreviews.length === 0) {
              form.setValue('imageUrl', optimizedImageUrl);
              form.setValue('imageFile', optimizedFile);
            }
            
            toast({
              title: "Afbeelding geoptimaliseerd",
              description: "De afbeelding is succesvol geoptimaliseerd en klaar voor gebruik.",
            });
          };
          
          img.src = readerEvent.target.result;
        };
        
        reader.readAsDataURL(file);
      });
    }
  };
  
  // Functie om een AI gegenereerde afbeelding te verwerken
  const handleAIGeneratedImage = (imageUrl: string) => {
    // Voeg toe aan de previews
    setImagePreviews(prev => [...prev, imageUrl]);
    
    // Als dit de eerste afbeelding is, gebruik deze als hoofdafbeelding
    if (imagePreviews.length === 0) {
      form.setValue('imageUrl', imageUrl);
    }
  };
  
  // Functie om een bepaalde afbeelding te verwijderen
  const removeImage = (index: number) => {
    // Verwijder preview en bestand uit de arrays
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    
    // Als we de hoofdafbeelding verwijderen, update formulier
    if (index === 0) {
      // Als er nog andere afbeeldingen zijn, gebruik de nieuwe eerste
      if (imagePreviews.length > 1) {
        const newMainImage = imagePreviews[1]; // De nieuwe eerste afbeelding na verwijdering
        form.setValue('imageUrl', newMainImage);
        if (selectedImages.length > 1) {
          form.setValue('imageFile', selectedImages[1]);
        }
      } else {
        // Anders, wis de hoofdafbeelding
        form.setValue('imageFile', undefined);
        form.setValue('imageUrl', undefined);
      }
    }
  };
  
  // Formulier indienen
  const onSubmit = (data: CreateEventFormValues) => {
    console.log('Formulier verzenden:', data);
    
    // Debug eventuele validatiefouten
    const formState = form.formState;
    console.log('Form state:', formState);
    
    // Toon een toast om te bevestigen dat de submit functie wordt aangeroepen
    toast({
      title: "Formulier verzenden...",
      description: "Bezig met het verwerken van het formulier"
    });
    
    if (formState.errors && Object.keys(formState.errors).length > 0) {
      console.error('Formulier validatiefouten:', formState.errors);
      toast({
        title: "Validatiefout",
        description: "Controleer alle verplichte velden en probeer opnieuw",
        variant: "destructive"
      });
      return;
    }
    
    // Zorg ervoor dat hostId is ingesteld voordat we de mutatie uitvoeren
    // Dit is verplicht volgens het server-side schema
    const completeData = {
      ...data,
      hostId: 1, // Standaard host ID (ingelogde gebruiker of admin)
    };
    
    // Als er geen validatiefouten zijn, probeer de mutatie uit te voeren
    try {
      console.log('Mutatie uitvoeren met data:', completeData);
      createEventMutation.mutate(completeData);
    } catch (err) {
      console.error('Fout bij het uitvoeren van createEventMutation:', err);
      toast({
        title: "Fout bij aanmaken evenement",
        description: "Er is een onverwachte fout opgetreden bij het aanmaken van het evenement.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="pb-20">
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild className="gap-1">
          <Link href="/app">
            <ChevronLeft className="h-4 w-4" />
            <span>Terug</span>
          </Link>
        </Button>
      </div>
      
      <div className="space-y-6">
        <Form {...form}>
          <form className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Basisinformatie</CardTitle>
                <CardDescription>
                  Vul de belangrijkste gegevens van je evenement in
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
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
                          onChange={(e) => {
                            field.onChange(e);
                            // AI wordt nu alleen uitsluitend door de handleTitleBlur aangeroepen
                          }}
                          onBlur={(e) => {
                            field.onBlur();
                            handleTitleBlur();
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Beschrijving</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Beschrijf je evenement" 
                          className="min-h-[120px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categorie</FormLabel>
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
                                {category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tijd en datum</CardTitle>
                <CardDescription>
                  Wanneer vindt het evenement plaats?
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="startTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Startdatum en -tijd</FormLabel>
                        <FormControl>
                          <DateTimePicker 
                            date={field.value} 
                            setDate={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="endTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Einddatum en -tijd</FormLabel>
                        <FormControl>
                          <DateTimePicker 
                            date={field.value} 
                            setDate={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Locatie</CardTitle>
                <CardDescription>
                  Waar vindt het evenement plaats?
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <LocationPicker
                  defaultPosition={[form.getValues('location.lat') || 51.7767, form.getValues('location.lng') || 5.5345]}
                  onChange={handleLocationChange}
                />
                
                <FormField
                  control={form.control}
                  name="location.address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Adres (optioneel)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Voeg een specifiek adres toe" 
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        Dit adres wordt getoond bij je evenement.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Afbeelding</CardTitle>
                <CardDescription>
                  Voeg een afbeelding toe aan je evenement
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="upload" className="w-full">
                  <TabsList className="mb-4">
                    <TabsTrigger value="upload">Uploaden</TabsTrigger>
                    <TabsTrigger value="generate">Genereren</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="upload" className="space-y-4">
                    <div className="space-y-4">
                      <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-border rounded-md">
                        <Image className="h-10 w-10 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground mb-4">
                          Sleep een afbeelding hierheen of klik om te bladeren
                        </p>
                        <Button
                          variant="outline"
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            document.getElementById('image-upload')?.click();
                          }}
                        >
                          Selecteer afbeelding
                        </Button>
                        <input
                          id="image-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageChange}
                        />
                      </div>
                      
                      {/* Afbeelding previews */}
                      {imagePreviews.length > 0 && (
                        <div>
                          <p className="text-sm font-medium mb-2">Geselecteerde afbeeldingen:</p>
                          <div className="grid grid-cols-5 gap-2">
                            {imagePreviews.map((preview, index) => (
                              <div key={index} className="relative group aspect-square rounded-md overflow-hidden border border-border">
                                <img
                                  src={preview}
                                  alt={`Voorbeeld ${index + 1}`}
                                  className="w-full h-full object-cover"
                                />
                                <button
                                  type="button"
                                  className="absolute top-1 right-1 bg-background text-destructive rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => removeImage(index)}
                                >
                                  <X className="h-4 w-4" />
                                </button>
                                {index === 0 && (
                                  <div className="absolute bottom-0 left-0 right-0 bg-primary/80 text-primary-foreground text-xs font-medium text-center py-1">
                                    Hoofdafbeelding
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="generate">
                    <ImageGenerator 
                      onGenerated={handleAIGeneratedImage}
                      eventTitle={form.getValues('title')}
                      eventCategory={form.getValues('category')}
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Extra opties</CardTitle>
                <CardDescription>
                  Aanvullende instellingen voor je evenement
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="hasMaxParticipants"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-4 p-4 border rounded-md">
                      <div>
                        <FormLabel className="font-medium">Maximum aantal deelnemers</FormLabel>
                        <FormDescription className="text-sm">
                          Beperk het aantal deelnemers voor dit evenement
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
                
                {form.watch('hasMaxParticipants') && (
                  <FormField
                    control={form.control}
                    name="maxParticipants"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Aantal deelnemers</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            placeholder="Bijv. 25"
                            {...field}
                            onChange={(e) => {
                              const value = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                              field.onChange(value);
                            }}
                            value={field.value === null || field.value === undefined ? '' : field.value}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
                <FormField
                  control={form.control}
                  name="isPaid"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-4 p-4 border rounded-md">
                      <div>
                        <FormLabel className="font-medium">Betaald evenement</FormLabel>
                        <FormDescription className="text-sm">
                          Is dit een betaald evenement?
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
                            min={0}
                            step={0.01}
                            placeholder="0.00"
                            {...field}
                            onChange={(e) => {
                              const value = e.target.value === '' ? undefined : parseFloat(e.target.value);
                              field.onChange(value);
                            }}
                            value={field.value === null || field.value === undefined ? '' : field.value}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </CardContent>
            </Card>
            
            <div className="sticky bottom-20 left-0 right-0 p-4 bg-background border-t mt-8">
              <Button 
                type="button" 
                className="w-full"
                size="lg"
                disabled={createEventMutation.isPending}
                onClick={() => {
                  const formData = form.getValues();
                  onSubmit(formData);
                }}
              >
                {createEventMutation.isPending ? 'Bezig met opslaan...' : 'Evenement aanmaken'}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}

export default AppCreateEventNew;