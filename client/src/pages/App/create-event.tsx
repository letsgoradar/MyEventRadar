import * as React from "react";
import { useState, useEffect } from "react";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { insertEventSchema } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { getLocationName } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ImageGenerator } from "@/components/Events/ImageGenerator";
import { DateTimePicker } from "@/components/date-time-picker";
import { CATEGORIES } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Image, Plus, X, MapPin, ChevronLeft } from "lucide-react";
import { Link } from "wouter";
import { suggestCategory, generateTags } from "@/lib/aiTagGenerator";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import AppBottomNav from "@/components/App/AppBottomNav";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix voor Leaflet iconen in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

// Aangepaste LocationPicker component - met standaard blauwe marker
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
  useEffect(() => {
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
    <div className="h-[300px] w-full rounded-md overflow-hidden border">
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

// Interface voor de locatie data
interface LocationData {
  lat: number;
  lng: number;
  locationName?: string;
  address?: string;
  notificationReach?: number;
}

// Uitgebreid schema voor het maken van een evenement
const createEventFormSchema = insertEventSchema.extend({
  hasMaxParticipants: z.boolean().default(false),
  maxParticipants: z.number().nullable().optional(),
  isPaid: z.boolean().default(false),
  price: z.number().nullable().optional(),
  imageFile: z.any().optional(),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
    locationName: z.string().optional(),
    address: z.string().optional(),
    notificationReach: z.number().optional(),
  }),
});

// Type voor formulierwaarden
type CreateEventFormValues = z.infer<typeof createEventFormSchema>;

const MAX_IMAGES = 5;

export function AppCreateEvent() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [imagePreviews, setImagePreviews] = React.useState<string[]>([]);
  const [selectedImages, setSelectedImages] = React.useState<File[]>([]);

  // Maak het formulier met standaardwaarden
  const form = useForm<CreateEventFormValues>({
    resolver: zodResolver(createEventFormSchema),
    defaultValues: {
      title: "",
      description: "",
      category: undefined,
      imageUrl: undefined,
      startTime: new Date(),
      endTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 uur later
      location: {
        lat: 51.7767,
        lng: 5.5345,
        locationName: "",
        address: "",
      },
      hostId: 1, // Dummy hostId (wordt op de server ingesteld op basis van ingelogde gebruiker)
      tags: [],
      hasMaxParticipants: false,
      maxParticipants: null,
      isPaid: false,
      price: null,
    },
  });

  // Mutatie voor het aanmaken van een evenement
  const createEventMutation = useMutation({
    mutationFn: async (data: CreateEventFormValues) => {
      return apiRequest('/api/events', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({
        title: "Evenement aangemaakt!",
        description: "Je evenement is succesvol aangemaakt.",
      });
      navigate("/app");
    },
    onError: (error: Error) => {
      console.error('Error creating event:', error);
      toast({
        title: "Fout bij aanmaken evenement",
        description: "Er is een fout opgetreden bij het aanmaken van het evenement.",
        variant: "destructive",
      });
    },
  });

  // Handler voor locatie wijzigingen
  const handleLocationChange = (lat: number, lng: number) => {
    form.setValue("location", {
      ...form.getValues("location"),
      lat: lat,
      lng: lng,
      locationName: getLocationName(lat, lng),
      address: ""
    });
  };

  // Handler voor als de titel verandert (voor automatische categorieaanvulling)
  const handleTitleBlur = () => {
    const title = form.getValues('title');
    const description = form.getValues('description');
    
    if (title && description && !form.getValues('category')) {
      const combinedText = `${title} ${description}`;
      const suggestedCategory = suggestCategory(combinedText);
      
      if (suggestedCategory) {
        form.setValue('category', suggestedCategory);
      }
    }
  };

  // Functie om tags te genereren op basis van titel, beschrijving en categorie
  const generateEventTags = () => {
    const title = form.getValues('title');
    const category = form.getValues('category');
    
    if (!title) {
      toast({
        title: "Titelvelden eerst invullen",
        description: "Vul eerst een titel in om tags te kunnen genereren",
        variant: "destructive"
      });
      return;
    }
    
    const tags = generateTags(title, category || "");
    if (tags && tags.length > 0) {
      form.setValue('tags', tags);
      toast({
        title: "Tags gegenereerd",
        description: `${tags.length} tags zijn toegevoegd op basis van evenementgegevens`,
      });
    } else {
      toast({
        title: "Geen tags gegenereerd",
        description: "Er konden geen relevante tags worden gegenereerd. Probeer de titel of beschrijving aan te passen.",
        variant: "destructive"
      });
    }
  };

  // Handler voor afbeelding uploads
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) {
      return;
    }

    // Check of we het maximum aantal afbeeldingen niet overschrijden
    if (imagePreviews.length >= MAX_IMAGES) {
      toast({
        title: "Maximum aantal afbeeldingen bereikt",
        description: `Je kunt maximaal ${MAX_IMAGES} afbeeldingen uploaden.`,
        variant: "destructive"
      });
      return;
    }

    const file = e.target.files[0];
    
    // Controleer bestandsformaat en grootte
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Ongeldig bestandsformaat",
        description: "Upload alleen afbeeldingen (JPG, PNG, etc.)",
        variant: "destructive"
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB max
      toast({
        title: "Bestand te groot",
        description: "De afbeelding mag maximaal 10MB zijn",
        variant: "destructive"
      });
      return;
    }

    // Verwerk de afbeelding voor upload
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
        description: "Er is een onverwachte fout opgetreden. Probeer het opnieuw.",
        variant: "destructive"
      });
    }
  };

  // Aangepaste layout voor mobiele weergave zonder de AppLayout component
  return (
    <div className="flex flex-col min-h-screen bg-background pb-16">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="container flex items-center justify-between h-14 px-4">
          <Button variant="ghost" size="sm" asChild className="gap-1">
            <Link href="/app">
              <ChevronLeft className="h-4 w-4" />
              <span>Terug</span>
            </Link>
          </Button>
          <h1 className="text-lg font-semibold">Nieuw Evenement</h1>
          <div className="w-8"></div> {/* Placeholder voor uitlijning */}
        </div>
      </header>

      {/* Inhoud */}
      <main className="flex-1 container px-4 pb-24 pt-4 overflow-auto">
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
                            
                            setTimeout(() => {
                              const description = form.getValues('description');
                              if (description && description.length > 5 && e.target.value.length > 3) {
                                const combinedText = `${e.target.value} ${description}`;
                                const suggestedCategory = suggestCategory(combinedText);
                                
                                if (suggestedCategory && !form.getValues('category')) {
                                  form.setValue('category', suggestedCategory);
                                }
                              }
                            }, 300);
                          }}
                          onBlur={handleTitleBlur}
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
                          className="min-h-[100px]"
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            
                            setTimeout(() => {
                              const title = form.getValues('title');
                              if (title && title.length > 3 && e.target.value.length > 5) {
                                const combinedText = `${title} ${e.target.value}`;
                                const suggestedCategory = suggestCategory(combinedText);
                                
                                if (suggestedCategory && !form.getValues('category')) {
                                  form.setValue('category', suggestedCategory);
                                }
                              }
                            }, 300);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categorie</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
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
                
                <FormField
                  control={form.control}
                  name="tags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex justify-between">
                        <span>Tags</span>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 px-2 text-xs"
                          onClick={generateEventTags}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Auto-genereren
                        </Button>
                      </FormLabel>
                      <FormControl>
                        <div className="flex flex-wrap gap-2">
                          {field.value?.map((tag, index) => (
                            <Badge key={index} className="flex gap-1 items-center">
                              {tag}
                              <X
                                className="h-3 w-3 cursor-pointer"
                                onClick={() => {
                                  const newTags = [...field.value || []];
                                  newTags.splice(index, 1);
                                  form.setValue('tags', newTags);
                                }}
                              />
                            </Badge>
                          ))}
                          <Input
                            placeholder="Voeg tags toe (druk op Enter)"
                            className="w-full mt-2"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const target = e.target as HTMLInputElement;
                                const value = target.value.trim();
                                
                                if (value && (!field.value || !field.value.includes(value))) {
                                  const newTags = [...(field.value || []), value];
                                  form.setValue('tags', newTags);
                                  target.value = '';
                                }
                              }
                            }}
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        Tags helpen gebruikers je evenement te vinden
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Datum en Tijd</CardTitle>
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
                      <FormLabel>Begintijd</FormLabel>
                      <DateTimePicker
                        date={field.value ? new Date(field.value) : undefined}
                        setDate={(date) => field.onChange(date)}
                        hideTime={false}
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
                      <FormLabel>Eindtijd</FormLabel>
                      <DateTimePicker
                        date={field.value ? new Date(field.value) : undefined}
                        setDate={(date) => field.onChange(date)}
                        hideTime={false}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Locatie</CardTitle>
                <CardDescription>
                  Waar vindt het evenement plaats?
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <LocationPicker 
                  defaultPosition={[
                    form.getValues('location')?.lat || 51.7767, 
                    form.getValues('location')?.lng || 5.5345
                  ]}
                  onChange={handleLocationChange}
                />
                <div className="flex items-center mt-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 mr-2" />
                  <span>
                    Lat: {(form.watch('location')?.lat || 0).toFixed(6)}, Lng: {(form.watch('location')?.lng || 0).toFixed(6)}
                  </span>
                </div>
                
                <FormField
                  control={form.control}
                  name="location.address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Adres</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Voer een volledig adres in"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Deelname</CardTitle>
                <CardDescription>
                  Is het evenement betaald? Is er een limiet op het aantal deelnemers?
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="isPaid"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Betaald evenement</FormLabel>
                        <FormDescription>
                          Bezoekers moeten betalen om deel te nemen
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={(checked) => {
                            field.onChange(checked);
                            if (!checked) {
                              form.setValue('price', null);
                            }
                          }}
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
                            min="0"
                            step="0.01"
                            placeholder="Prijs in euro's"
                            {...field}
                            value={field.value === null ? '' : field.value}
                            onChange={(e) => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
                <FormField
                  control={form.control}
                  name="hasMaxParticipants"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Maximum aantal deelnemers</FormLabel>
                        <FormDescription>
                          Beperk het aantal mensen dat kan deelnemen
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={(checked) => {
                            field.onChange(checked);
                            if (!checked) {
                              form.setValue('maxParticipants', null);
                            }
                          }}
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
                        <FormLabel>Maximum aantal deelnemers</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            placeholder="Maximum aantal deelnemers"
                            {...field}
                            value={field.value === null ? '' : field.value}
                            onChange={(e) => field.onChange(e.target.value === '' ? null : parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Afbeelding</CardTitle>
                <CardDescription>
                  Voeg een afbeelding toe voor je evenement
                </CardDescription>
              </CardHeader>
              <CardContent>
                {imagePreviews.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {imagePreviews.map((url, index) => (
                        <div key={index} className="relative">
                          <img
                            src={url}
                            alt={`Preview ${index + 1}`}
                            className="h-20 w-20 object-cover rounded-md border"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                            onClick={() => removeImage(index)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                          {index === 0 && (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="absolute -bottom-2 -right-2 h-6 px-2 text-xs rounded-full"
                            >
                              Hoofd
                            </Button>
                          )}
                        </div>
                      ))}
                      {imagePreviews.length < MAX_IMAGES && (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-20 w-20 border-dashed"
                          onClick={() => document.getElementById('image-upload')?.click()}
                        >
                          <Plus className="h-8 w-8 text-muted-foreground" />
                          <input
                            id="image-upload"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleImageChange}
                          />
                        </Button>
                      )}
                    </div>
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
                      </TabsContent>
                    </Tabs>
                  </div>
                )}
              </CardContent>
            </Card>
          </form>
        </Form>
      </main>

      {/* Vaste knoppenbalk onderaan */}
      <div className="fixed bottom-14 left-0 right-0 flex gap-4 p-4 bg-background border-t z-10">
        <Button 
          type="button" 
          variant="outline" 
          className="flex-1"
          onClick={() => navigate("/app")}
        >
          Annuleren
        </Button>
        <Button 
          type="button" 
          className="flex-1"
          onClick={form.handleSubmit(onSubmit)}
          disabled={createEventMutation.isPending}
        >
          {createEventMutation.isPending ? (
            <>Aanmaken...</>
          ) : (
            <>Evenement aanmaken</>
          )}
        </Button>
      </div>

      {/* Navigatiebalk onderaan */}
      <AppBottomNav />
    </div>
  );
}

export default AppCreateEvent;