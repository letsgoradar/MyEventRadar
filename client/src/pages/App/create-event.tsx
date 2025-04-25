import * as React from "react";
import AppLayout from "@/components/App/AppLayout";
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
import { LocationPicker } from "@/components/Events/LocationPicker";
import { suggestCategory, generateTags } from "@/lib/aiTagGenerator";

// Uitgebreid schema voor het maken van een evenement
const createEventFormSchema = insertEventSchema.extend({
  hasMaxParticipants: z.boolean().default(false),
  maxParticipants: z.number().nullable().optional(),
  isPaid: z.boolean().default(false),
  price: z.number().nullable().optional(),
  imageFile: z.any().optional(),
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
        notificationReach: 5.0,
        locationName: "",
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
  const handleLocationChange = (position: [number, number]) => {
    const currentLocation = form.getValues("location");
    form.setValue("location", {
      ...currentLocation,
      lat: position[0],
      lng: position[1],
      // Behoud notificationReach als deze al is ingesteld, anders gebruik standaardwaarde
      notificationReach: currentLocation?.notificationReach || 5.0,
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

  return (
    <AppLayout title="Nieuw Evenement">
      <div className="flex flex-col h-full">
        {/* Terug knop in header */}
        <div className="mb-4">
          <Button variant="ghost" size="sm" asChild className="gap-1">
            <Link href="/app">
              <ChevronLeft className="h-4 w-4" />
              <span>Terug</span>
            </Link>
          </Button>
        </div>
        
        {/* Scrollbare inhoud */}
        <div className="pb-20 overflow-y-auto flex-1">
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
                              
                              // Als er al een beschrijving is, kan er een categorie worden voorgesteld
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
                            placeholder="Beschrijf wat mensen kunnen verwachten" 
                            className="min-h-[120px]"
                            {...field} 
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
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Afbeelding (verplicht)</CardTitle>
                  <CardDescription>
                    Een afbeelding helpt je evenement op te vallen
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {imagePreviews.length > 0 ? (
                    <div className="space-y-4">
                      <div className="relative h-48 w-full rounded-md overflow-hidden">
                        <img 
                          src={imagePreviews[0]} 
                          alt="Hoofdafbeelding evenement" 
                          className="w-full h-full object-cover"
                        />
                        <Button 
                          variant="destructive" 
                          size="icon" 
                          className="absolute top-2 right-2" 
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            removeImage(0);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      {/* Extra afbeeldingen (max 5) */}
                      {imagePreviews.length > 1 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">Extra afbeeldingen</h4>
                          <div className="grid grid-cols-4 gap-2">
                            {imagePreviews.slice(1).map((preview, index) => (
                              <div key={index} className="relative h-20 rounded-md overflow-hidden">
                                <img 
                                  src={preview} 
                                  alt={`Evenement afbeelding ${index + 2}`} 
                                  className="w-full h-full object-cover"
                                />
                                <Button 
                                  variant="destructive" 
                                  size="icon" 
                                  className="absolute top-1 right-1 h-5 w-5" 
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    removeImage(index + 1);
                                  }}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                            
                            {/* Upload knop voor extra afbeeldingen */}
                            {imagePreviews.length < MAX_IMAGES && (
                              <div 
                                className="relative h-20 border-2 border-dashed border-border rounded-md flex items-center justify-center cursor-pointer"
                                onClick={(e) => {
                                  e.preventDefault();
                                  document.getElementById('additional-image-upload')?.click();
                                }}
                              >
                                <Plus className="h-5 w-5 text-muted-foreground" />
                                <input
                                  id="additional-image-upload"
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={handleImageChange}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Toon upload knop als we nog niet het maximum hebben bereikt */}
                      {imagePreviews.length === 1 && imagePreviews.length < MAX_IMAGES && (
                        <Button
                          variant="outline"
                          type="button"
                          className="w-full"
                          onClick={(e) => {
                            e.preventDefault();
                            document.getElementById('additional-image-upload')?.click();
                          }}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Voeg nog een afbeelding toe ({imagePreviews.length}/{MAX_IMAGES})
                          <input
                            id="additional-image-upload"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleImageChange}
                          />
                        </Button>
                      )}
                    </div>
                  ) : (
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
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Datum en tijd</CardTitle>
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
                          className="relative z-50"
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
                          placement="top"
                          className="relative z-40"
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
                    <span className="text-lg">Tags</span>
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
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Extra opties</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="hasMaxParticipants"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Beperkt aantal deelnemers</FormLabel>
                          <FormDescription>
                            Beperk het maximaal aantal deelnemers
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
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  
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
    </AppLayout>
  );
}

export default AppCreateEvent;