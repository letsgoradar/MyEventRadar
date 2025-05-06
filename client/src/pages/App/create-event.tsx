import * as React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
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
import { Image, Plus, X, MapPin, ChevronLeft, ChevronRight, Check, AlertCircle } from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Fix voor Leaflet iconen in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

// LocationPicker component
const LocationPicker = ({ 
  defaultPosition = [51.7767, 5.5345] as [number, number],
  onChange
}: { 
  defaultPosition?: [number, number], 
  onChange: (lat: number, lng: number) => void 
}) => {
  const [markerPosition, setMarkerPosition] = useState<[number, number]>(defaultPosition);
  const initRef = useRef(false);
  
  useEffect(() => {
    if (!initRef.current) {
      onChange(defaultPosition[0], defaultPosition[1]);
      initRef.current = true;
    }
  }, [onChange, defaultPosition]);
  
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

// Form schema
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
  }),
});

// Type voor formulierwaarden
type CreateEventFormValues = z.infer<typeof createEventFormSchema>;

// Stappen van de wizard
type StepType = {
  id: number;
  title: string;
  description: string;
  fields: (keyof CreateEventFormValues)[];
};

const steps: StepType[] = [
  {
    id: 1,
    title: "Basisinformatie",
    description: "Vul de belangrijkste gegevens van je evenement in",
    fields: ["title", "description", "category", "tags"],
  },
  {
    id: 2,
    title: "Datum en Tijd",
    description: "Wanneer vindt het evenement plaats?",
    fields: ["startTime", "endTime"],
  },
  {
    id: 3,
    title: "Locatie",
    description: "Waar vindt het evenement plaats?",
    fields: ["location"],
  },
  {
    id: 4,
    title: "Deelname",
    description: "Is het evenement betaald? Is er een limiet op het aantal deelnemers?",
    fields: ["isPaid", "price", "hasMaxParticipants", "maxParticipants"],
  },
  {
    id: 5,
    title: "Afbeelding",
    description: "Voeg een afbeelding toe voor je evenement",
    fields: ["imageUrl"],
  },
];

const MAX_IMAGES = 5;

export function AppCreateEvent() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [imagePreviews, setImagePreviews] = React.useState<string[]>([]);
  const [selectedImages, setSelectedImages] = React.useState<File[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [stepValidations, setStepValidations] = useState<Record<number, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [stepErrors, setStepErrors] = useState<Record<number, string[]>>({});

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
      },
      hostId: 1, // Dummy hostId (wordt op de server ingesteld op basis van ingelogde gebruiker)
      tags: [],
      hasMaxParticipants: false,
      maxParticipants: null,
      isPaid: false,
      price: null,
    },
    mode: "onChange", // Valideer telkens als er iets verandert
  });

  // Handler voor locatie wijzigingen
  const handleLocationChange = useCallback((lat: number, lng: number) => {
    form.setValue("location", {
      ...form.getValues("location"),
      lat: lat,
      lng: lng,
      locationName: getLocationName(lat, lng),
    });
  }, [form]);

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
      setIsSubmitting(false);
    },
  });

  // Ga naar de volgende stap
  const goToNextStep = async () => {
    // Valideer huidige stap
    const currentStepFields = steps[currentStep - 1].fields;
    
    // Valideer de velden van de huidige stap
    const result = await validateStep(currentStep);
    
    if (result.valid) {
      // Ga naar de volgende stap als er geen fouten zijn
      if (currentStep < steps.length) {
        setCurrentStep(currentStep + 1);
        window.scrollTo(0, 0); // Scroll naar boven
      } else {
        // Als dit de laatste stap is, verstuur het formulier
        submitForm();
      }
    }
  };

  // Ga naar de vorige stap
  const goToPreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo(0, 0); // Scroll naar boven
    }
  };

  // Valideer een specifieke stap
  const validateStep = async (stepNumber: number): Promise<{ valid: boolean, errors: string[] }> => {
    const step = steps[stepNumber - 1];
    const stepFields = step.fields;
    let errors: string[] = [];
    
    // Speciale validatie per stap
    switch (stepNumber) {
      case 1: // Basisinformatie
        if (!form.getValues('title')) {
          errors.push("Titel is verplicht");
        }
        if (!form.getValues('description')) {
          errors.push("Beschrijving is verplicht");
        }
        if (!form.getValues('category')) {
          errors.push("Categorie is verplicht");
        }
        break;
        
      case 2: // Datum en Tijd
        const startTime = form.getValues('startTime');
        const endTime = form.getValues('endTime');
        
        if (!startTime) {
          errors.push("Begintijd is verplicht");
        }
        
        if (startTime && endTime && new Date(startTime) >= new Date(endTime)) {
          errors.push("Eindtijd moet na begintijd liggen");
        }
        break;
        
      case 3: // Locatie
        // Locatie wordt automatisch ingesteld, geen extra validatie nodig
        break;
        
      case 4: // Deelname
        if (form.getValues('isPaid') && (form.getValues('price') === null || form.getValues('price') === undefined)) {
          errors.push("Vul een prijs in voor een betaald evenement");
        }
        
        if (form.getValues('hasMaxParticipants') && (form.getValues('maxParticipants') === null || form.getValues('maxParticipants') === undefined)) {
          errors.push("Vul het maximum aantal deelnemers in");
        }
        break;
        
      case 5: // Afbeelding
        // Afbeelding is optioneel, geen validatie nodig
        break;
    }
    
    // Update de validatiestatus voor deze stap
    setStepValidations({
      ...stepValidations,
      [stepNumber]: errors.length === 0,
    });
    
    // Update de fouten voor deze stap
    setStepErrors({
      ...stepErrors,
      [stepNumber]: errors,
    });
    
    return { valid: errors.length === 0, errors };
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
  const submitForm = async () => {
    // Controleer alle stappen nog een keer
    let allValid = true;
    for (let i = 1; i <= steps.length; i++) {
      const result = await validateStep(i);
      if (!result.valid) {
        allValid = false;
        setCurrentStep(i); // Ga naar de eerste stap met fouten
        break;
      }
    }
    
    if (!allValid) {
      toast({
        title: "Validatiefout",
        description: "Controleer alle verplichte velden en probeer opnieuw",
        variant: "destructive"
      });
      return;
    }
    
    setIsSubmitting(true);
    
    // Zorg ervoor dat hostId is ingesteld voordat we de mutatie uitvoeren
    const completeData = {
      ...form.getValues(),
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
      setIsSubmitting(false);
    }
  };

  // Bereken de voortgang
  const progressPercentage = (currentStep / steps.length) * 100;

  // Huidige stap object
  const currentStepObj = steps[currentStep - 1];

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

      {/* Stappen indicator */}
      <div className="container px-4 pt-4 pb-2">
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium">Stap {currentStep} van {steps.length}</span>
          <span className="text-sm text-muted-foreground">{currentStepObj.title}</span>
        </div>
        <Progress value={progressPercentage} className="h-2" />
      </div>

      {/* Inhoud - hoofdgedeelte */}
      <main className="flex-1 container px-4 pb-24 pt-2 overflow-auto">
        <Form {...form}>
          <form className="space-y-6">
            {/* Foutmeldingen tonen */}
            {stepErrors[currentStep] && stepErrors[currentStep].length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Fout</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-5">
                    {stepErrors[currentStep].map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Stap 1: Basisinformatie */}
            {currentStep === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{currentStepObj.title}</CardTitle>
                  <CardDescription>
                    {currentStepObj.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Titel <span className="text-destructive">*</span></FormLabel>
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
                        <FormLabel>Beschrijving <span className="text-destructive">*</span></FormLabel>
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
                        <FormLabel>Categorie <span className="text-destructive">*</span></FormLabel>
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
            )}
            
            {/* Stap 2: Datum en Tijd */}
            {currentStep === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{currentStepObj.title}</CardTitle>
                  <CardDescription>
                    {currentStepObj.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="startTime"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Begintijd <span className="text-destructive">*</span></FormLabel>
                        <DateTimePicker
                          date={field.value ? new Date(field.value) : undefined}
                          setDate={(date) => field.onChange(date)}
                          mode="datetime"
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
                          mode="datetime"
                        />
                        <FormDescription>
                          Laat leeg voor evenementen zonder eindtijd
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            )}
            
            {/* Stap 3: Locatie */}
            {currentStep === 3 && (
              <Card className="relative" style={{ zIndex: 10 }}>
                <CardHeader>
                  <CardTitle className="text-lg">{currentStepObj.title}</CardTitle>
                  <CardDescription>
                    {currentStepObj.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="mb-4">Klik op de kaart om de locatie te kiezen:</p>
                  <LocationPicker 
                    defaultPosition={[
                      form.getValues('location')?.lat || 51.7767, 
                      form.getValues('location')?.lng || 5.5345
                    ]}
                    onChange={handleLocationChange}
                  />
                </CardContent>
              </Card>
            )}
            
            {/* Stap 4: Deelname */}
            {currentStep === 4 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{currentStepObj.title}</CardTitle>
                  <CardDescription>
                    {currentStepObj.description}
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
                          <FormLabel>Prijs (€) <span className="text-destructive">*</span></FormLabel>
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
                          <FormLabel>Maximum aantal deelnemers <span className="text-destructive">*</span></FormLabel>
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
            )}
            
            {/* Stap 5: Afbeelding */}
            {currentStep === 5 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{currentStepObj.title}</CardTitle>
                  <CardDescription>
                    {currentStepObj.description}
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
            )}
          </form>
        </Form>
      </main>

      {/* Navigatieknoppen onderaan */}
      <div className="fixed bottom-14 left-0 right-0 flex gap-4 p-4 bg-background border-t z-10">
        {currentStep > 1 ? (
          <Button 
            type="button" 
            variant="outline" 
            className="flex-1"
            onClick={goToPreviousStep}
            disabled={isSubmitting}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Vorige
          </Button>
        ) : (
          <Button 
            type="button" 
            variant="outline" 
            className="flex-1"
            onClick={() => navigate("/app")}
            disabled={isSubmitting}
          >
            Annuleren
          </Button>
        )}
        
        <Button 
          type="button" 
          className="flex-1"
          onClick={currentStep < steps.length ? goToNextStep : submitForm}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>Aanmaken...</>
          ) : currentStep < steps.length ? (
            <>
              Volgende
              <ChevronRight className="h-4 w-4 ml-1" />
            </>
          ) : (
            <>
              Evenement aanmaken
              <Check className="h-4 w-4 ml-1" />
            </>
          )}
        </Button>
      </div>

      {/* Navigatiebalk onderaan */}
      <AppBottomNav />
    </div>
  );
}

export default AppCreateEvent;