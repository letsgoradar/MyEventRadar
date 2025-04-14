import React, { useState, useCallback, useEffect } from 'react';
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
    // Update het locatie-object met nieuwe coördinaten
    const currentLocation = form.getValues('location') || {};
    form.setValue('location', { 
      ...currentLocation, 
      lat, 
      lng,
      notificationReach: currentLocation.notificationReach || 5.0
    });
  };
  
  // Functie om afbeelding te resizen en verwerken
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
      const img = new Image();
      const reader = new FileReader();
      
      reader.onload = (readerEvent) => {
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
          
          // Gebruik deze als preview
          setImagePreview(optimizedImageUrl);
          form.setValue('imageUrl', optimizedImageUrl);
          
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
          
          setSelectedImage(optimizedFile);
          form.setValue('imageFile', optimizedFile);
          
          toast({
            title: "Afbeelding geoptimaliseerd",
            description: "De afbeelding is succesvol geoptimaliseerd en klaar voor gebruik.",
          });
        };
        
        img.src = readerEvent.target?.result as string;
      };
      
      reader.readAsDataURL(file);
    }
  };
  
  // Functie om een AI gegenereerde afbeelding te verwerken
  const handleAIGeneratedImage = (imageUrl: string) => {
    setImagePreview(imageUrl);
    // Nu hebben we een imageUrl veld in het schema toegevoegd
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
        description: "Er is een onverwachte fout opgetreden. Probeer het opnieuw.",
        variant: "destructive"
      });
    }
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
            <form className="space-y-8">
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
                                  // Originele onChange aanroepen
                                  field.onChange(e);
                                  
                                  // Als er al een beschrijving is, kan er een categorie worden voorgesteld
                                  setTimeout(() => {
                                    const description = form.getValues('description');
                                    if (description && description.length > 5 && e.target.value.length > 3) {
                                      const combinedText = `${e.target.value} ${description}`;
                                      const suggestedCategory = suggestCategory(combinedText);
                                      
                                      // Als we een categorie kunnen suggereren en er nog geen is, doe dat dan
                                      if (suggestedCategory && !form.getValues('category')) {
                                        form.setValue('category', suggestedCategory);
                                      }
                                    }
                                  }, 300);
                                }}
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
                                onChange={(e) => {
                                  // Zorg ervoor dat de originele onChange wordt aangeroepen
                                  field.onChange(e);
                                  
                                  // Direct categorie voorstellen op basis van titel en beschrijving
                                  const title = form.getValues('title');
                                  const description = e.target.value;
                                  
                                  // Combineer data voor categoriesuggestie
                                  if (title && description && description.length > 5) {
                                    const combinedText = `${title} ${description}`;
                                    const suggestedCategory = suggestCategory(combinedText);
                                    
                                    // Als we een categorie kunnen suggereren, doe dat dan
                                    if (suggestedCategory && !form.getValues('category')) {
                                      // Vertraag de update even om te voorkomen dat het te snel gebeurt
                                      setTimeout(() => {
                                        form.setValue('category', suggestedCategory);
                                      }, 300);
                                    }
                                  }
                                }}
                              />
                            </FormControl>
                            <FormDescription>
                              Geef gedetailleerde informatie over je evenement
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
                              <FormLabel>Categorie</FormLabel>
                              <Select
                                onValueChange={(value) => {
                                  field.onChange(value);
                                  
                                  // Direct de ImageGenerator component bijwerken als die wordt weergegeven
                                  // Dit triggert de useEffect in ImageGenerator die de prompt zal updaten
                                  
                                  // Wacht even zodat de categorie update kan worden verwerkt
                                  setTimeout(() => {
                                    // Update eventuele andere velden die afhankelijk zijn van de categorie
                                    form.trigger(['title', 'description']);
                                  }, 100);
                                }}
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
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                      </div>
                      
                      {/* Afbeelding sectie direct na categorie */}
                      <Card className="mt-6">
                        <CardHeader>
                          <CardTitle className="text-xl">Afbeelding (verplicht)</CardTitle>
                          <CardDescription>
                            Een afbeelding is verplicht. Upload een eigen afbeelding of laat er een genereren.
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          {imagePreview ? (
                            <div className="relative h-60 w-full rounded-md overflow-hidden">
                              <img 
                                src={imagePreview} 
                                alt="Event preview" 
                                className="w-full h-full object-cover"
                              />
                              <Button 
                                variant="destructive" 
                                size="icon" 
                                className="absolute top-2 right-2" 
                                onClick={removeImage}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <Tabs defaultValue="ai">
                                <TabsList className="grid w-full grid-cols-2">
                                  <TabsTrigger value="ai">AI Genereren</TabsTrigger>
                                  <TabsTrigger value="upload">Uploaden</TabsTrigger>
                                </TabsList>
                                <TabsContent value="ai" className="py-4">
                                  <ImageGenerator
                                    title={form.watch('title') || ''}
                                    category={form.watch('category') || ''}
                                    description={form.watch('description') || ''}
                                    onImageGenerated={handleAIGeneratedImage}
                                  />
                                </TabsContent>
                                <TabsContent value="upload" className="py-4">
                                  <div className="flex flex-col items-center justify-center h-60 border-2 border-dashed border-border rounded-md">
                                    <Image className="h-10 w-10 text-muted-foreground mb-2" />
                                    <p className="text-sm text-muted-foreground mb-4">
                                      Sleep een afbeelding hierheen of klik om te bladeren
                                    </p>
                                    <Button
                                      variant="outline"
                                      onClick={() => document.getElementById('image-upload')?.click()}
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
                                </TabsContent>
                              </Tabs>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        <FormField
                          control={form.control}
                          name="hasMaxParticipants"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 mb-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">Beperkt aantal deelnemers</FormLabel>
                                <FormDescription>
                                  Beperk het maximaal aantal deelnemers voor dit evenement
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
                      </div>
                      
                      <div className="space-y-4">
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
                      </div>
                    </CardContent>
                  </Card>
                </div>
                
                {/* Rechter kolom - Datum/tijd en locatie (volgorde omgedraaid) */}
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-xl">Datum en tijd</CardTitle>
                      <CardDescription>
                        Wanneer vindt het evenement plaats?
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <FormField
                        control={form.control}
                        name="startTime"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Startdatum en -tijd</FormLabel>
                            <DateTimePicker
                              date={field.value}
                              setDate={field.onChange}
                              placement="top"
                              label=""
                              className="z-50"
                            />
                            <FormDescription>
                              Datum en tijd waarop het evenement begint
                            </FormDescription>
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
                              placement="top"
                              label=""
                              className="z-40"
                            />
                            <FormDescription>
                              Datum en tijd waarop het evenement eindigt
                            </FormDescription>
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
                          form.getValues('location')?.lat || 51.7767, 
                          form.getValues('location')?.lng || 5.5345
                        ]}
                        onChange={handleLocationChange}
                      />
                      <div className="flex items-center mt-4 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4 mr-2" />
                        <span>
                          Lat: {(form.watch('location')?.lat || 0).toFixed(6)}, Lng: {(form.watch('location')?.lng || 0).toFixed(6)}
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
                  type="button" 
                  disabled={createEventMutation.isPending}
                  onClick={() => {
                    console.log('Submit button clicked');
                    try {
                      // Verzamel de formuliergegevens
                      const formData = form.getValues();
                      console.log('Form data:', formData);
                      
                      // Toon een toast als bevestiging van de klik
                      toast({
                        title: "Evenement wordt aangemaakt...",
                        description: "Bezig met verwerken van het formulier"
                      });
                      
                      // Voer onSubmit uit met de huidige formulierwaarden
                      onSubmit(formData);
                    } catch (error) {
                      console.error('Error in form submission:', error);
                      toast({
                        title: "Fout bij verwerken formulier",
                        description: "Er is een probleem opgetreden bij het verwerken van het formulier",
                        variant: "destructive"
                      });
                    }
                  }}
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