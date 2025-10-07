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
import { AutoImageSelector } from "@/components/Events/AutoImageSelector";
import { DateTimePickerSeparate } from "@/components/date-picker-separate";
import { useAuth } from "@/hooks/use-auth";
import { CATEGORIES } from "@shared/schema";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Image, X, ChevronLeft, ChevronRight, Check, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { suggestCategory } from "@/lib/aiTagGenerator";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import AppBottomNav from "@/components/App/AppBottomNav";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getBestCategoryImage } from "@/lib/categoryImages";
import CategoryImageSelector from "@/components/Events/CategoryImageSelector";
import StepperTimeline from "@/components/Events/StepperTimeline";

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

  // Gebruik een hogere zoom level voor mobiel
  return (
    <div className="h-[300px] w-full rounded-md overflow-hidden border">
      <MapContainer
        center={markerPosition}
        zoom={14} // Hogere zoom voor betere locatie selectie
        scrollWheelZoom={true}
        className="h-full w-full"
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
    notificationReach: z.number().default(1.5), // Voeg notificationReach toe met standaardwaarde
  }),
});

// Type voor formulierwaarden
type CreateEventFormValues = z.infer<typeof createEventFormSchema>;

// Stappen van de wizard
type StepType = {
  id: number;
  title: string;
  fields: (keyof CreateEventFormValues)[];
};

const steps: StepType[] = [
  {
    id: 1,
    title: "Omschrijving",
    fields: ["title", "description", "category"],
  },
  {
    id: 2,
    title: "Datum/tijd",
    fields: ["startTime", "endTime"],
  },
  {
    id: 3,
    title: "Locatie",
    fields: ["location"],
  },
  {
    id: 4,
    title: "Deelname",
    fields: ["isPaid", "price", "hasMaxParticipants", "maxParticipants"],
  },
  {
    id: 5,
    title: "Afbeelding",
    fields: ["imageUrl"],
  },
];

const MAX_IMAGES = 5;

export function AppCreateEvent() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [stepValidations, setStepValidations] = useState<Record<number, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [stepErrors, setStepErrors] = useState<Record<number, string[]>>({});
  const [imageTabValue, setImageTabValue] = useState<string>("category"); // default tab voor afbeeldingen

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
        notificationReach: 1.5, // Standaard bereik in km
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
      notificationReach: 1.5, // Zorg dat deze waarde altijd wordt ingesteld
    });
  }, [form]);

  // Mutatie voor het aanmaken van een evenement
  const createEventMutation = useMutation({
    mutationFn: async (data: any) => {
      // Data is nu al geformatteerd in het submitForm-functie
      // zodat het de juiste structuur heeft voor het API endpoint
      
      console.log("Sending event data to server:", JSON.stringify(data, null, 2));
      
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

  // Handler voor rechtstreeks naar een stap navigeren
  const handleGoToStep = (stepId: number) => {
    // Als we terug willen gaan, of als we naar een stap willen waar we al voorbij zijn
    if (stepId < currentStep) {
      setCurrentStep(stepId);
      window.scrollTo(0, 0);
      return;
    }
    
    // Als we vooruit willen, valideer alle stappen tot aan de gewenste stap
    validateAndGoToStep(stepId);
  };

  // Valideer alle stappen tot aan een bepaalde stap en ga dan naar die stap
  const validateAndGoToStep = async (targetStep: number) => {
    let latestValidStep = currentStep;
    
    // Valideer alle stappen tot aan targetStep
    for (let i = currentStep; i < targetStep; i++) {
      const result = await validateStep(i);
      if (!result.valid) {
        // Stop bij de eerste ongeldige stap
        setCurrentStep(i);
        window.scrollTo(0, 0);
        return;
      }
      latestValidStep = i + 1;
    }
    
    // Als we hier zijn, zijn alle stappen tot aan targetStep geldig
    setCurrentStep(targetStep);
    window.scrollTo(0, 0);
  };

  // Ga naar de volgende stap
  const goToNextStep = async () => {
    // Valideer huidige stap
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

  // De AI-selectie gebeurt nu in de CategoryImageSelector component

  // Valideer een specifieke stap
  const validateStep = async (stepNumber: number): Promise<{ valid: boolean, errors: string[] }> => {
    const step = steps[stepNumber - 1];
    const stepFields = step.fields;
    let errors: string[] = [];
    
    // Speciale validatie per stap
    switch (stepNumber) {
      case 1: // Omschrijving
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
        if (!form.getValues('imageUrl')) {
          errors.push("Kies een afbeelding voor je evenement");
        }
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
        
        // Update previews en selectie
        setImagePreviews([optimizedImageUrl]); // Vervang eventuele bestaande afbeeldingen
        
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
        setSelectedImages([optimizedFile]); // Vervang eventuele bestaande geselecteerde afbeeldingen
        
        // Update het formulier
        form.setValue('imageUrl', optimizedImageUrl);
        form.setValue('imageFile', optimizedFile);
        
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
    // Update preview en formulier
    setImagePreviews([imageUrl]); // Vervang eventuele bestaande afbeeldingen
    form.setValue('imageUrl', imageUrl);
    
    toast({
      title: "AI afbeelding gegenereerd",
      description: "De gegenereerde afbeelding is ingesteld voor je evenement.",
    });
  };

  // Handler voor categorie-afbeelding selectie
  const handleCategoryImageSelect = (imageUrl: string) => {
    setImagePreviews([imageUrl]); // Vervang eventuele bestaande afbeeldingen
    form.setValue('imageUrl', imageUrl);
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
    
    // Haal de formulierwaarden op en bereid ze voor voor verzending
    const formValues = form.getValues();
    
    // Upload de afbeelding eerst als er een is geselecteerd
    let uploadedImageUrl = formValues.imageUrl;
    
    if (selectedImages.length > 0 && selectedImages[0]) {
      try {
        console.log("Uploading image for event...");
        
        const formData = new FormData();
        formData.append('photo', selectedImages[0]);
        
        // Upload de afbeelding met fetch API
        const response = await fetch('/api/profile-photo', {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error('Upload failed');
        }
        
        const uploadResponse = await response.json();
        
        uploadedImageUrl = uploadResponse.photoUrl.startsWith('http') 
          ? uploadResponse.photoUrl 
          : window.location.origin + uploadResponse.photoUrl;
          
        console.log("Image uploaded successfully:", uploadedImageUrl);
        
      } catch (error) {
        console.error("Failed to upload image:", error);
        toast({
          title: "Afbeelding upload mislukt",
          description: "De afbeelding kon niet worden geüpload, maar het event wordt wel aangemaakt.",
          variant: "destructive"
        });
      }
    }
    
    // Creëer de juiste velden voor latitude en longitude van de locatie
    // om compatibel te zijn met het schema
    const latitude = formValues.location?.lat;
    const longitude = formValues.location?.lng;
    const locationName = formValues.location?.locationName || "";
    const notificationReach = formValues.location?.notificationReach || 1.5;
    
    // Fix voor het maxParticipants probleem - zet het op 0 als het null is
    const maxParticipants = formValues.hasMaxParticipants ? 
      (formValues.maxParticipants || 0) : // Als het null is, zet het op 0
      0; // Als hasMaxParticipants false is, zet het op 0
    
    // Debug info
    console.log("FormValues bij submit:", formValues);
    console.log("Location data:", {
      latitude, longitude, locationName, notificationReach
    });
    
    // Bereid de complete data voor in het juiste formaat voor het API endpoint
    const completeData = {
      ...formValues,
      // Verwijder het location object en gebruik de individuele velden
      latitude: latitude,
      longitude: longitude,
      address: locationName,
      notificationReach: notificationReach,
      hostId: 1, // Standaard host ID (ingelogde gebruiker of admin)
      maxParticipants: maxParticipants, // Gebruik de aangepaste waarde
      imageUrl: uploadedImageUrl, // Gebruik de geüploade afbeelding URL
    };
    
    // Verwijder het location object, maar maak een veilige kopie zonder het location veld
    const { location, ...dataWithoutLocation } = completeData;
    
    // Debug-log om te zien wat we precies verzenden
    console.log('Verzenden gegevens:', JSON.stringify(dataWithoutLocation, null, 2));
    
    // Als er geen validatiefouten zijn, probeer de mutatie uit te voeren
    try {
      console.log('Mutatie uitvoeren met data:', dataWithoutLocation);
      createEventMutation.mutate(dataWithoutLocation as any);
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

  // Aangepaste layout voor mobiele weergave zonder de AppLayout component
  return (
    <div className="flex flex-col min-h-[100dvh] bg-background">
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
        <StepperTimeline 
          steps={steps} 
          currentStep={currentStep} 
          onStepClick={handleGoToStep}
        />
      </div>

      {/* Inhoud - hoofdgedeelte */}
      <main className="flex-1 container px-4 pb-36 pt-2 overflow-auto">
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

            {/* Stap 1: Omschrijving */}
            {currentStep === 1 && (
              <Card>
                <CardContent className="pt-6 space-y-6">
                  <CardTitle>Omschrijving</CardTitle>
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
                </CardContent>
              </Card>
            )}
            
            {/* Stap 2: Datum en Tijd */}
            {currentStep === 2 && (
              <Card>
                <CardContent className="pt-6 space-y-6">
                  <CardTitle>Datum en tijd</CardTitle>
                  <FormField
                    control={form.control}
                    name="startTime"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Begintijd <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <DateTimePickerSeparate
                            date={field.value ? new Date(field.value) : undefined}
                            setDate={(date) => field.onChange(date)}
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
                      <FormItem className="flex flex-col">
                        <FormLabel>Eindtijd</FormLabel>
                        <FormControl>
                          <DateTimePickerSeparate
                            date={field.value ? new Date(field.value) : undefined}
                            setDate={(date) => field.onChange(date)}
                          />
                        </FormControl>
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
                <CardContent className="pt-6 space-y-6">
                  <CardTitle>Locatie</CardTitle>
                  <p className="text-sm">Klik op de kaart om de locatie te kiezen:</p>
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
                <CardContent className="pt-6 space-y-6">
                  <CardTitle>Deelname</CardTitle>
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
                <CardContent className="pt-6 space-y-6">
                  <CardTitle>Afbeelding</CardTitle>
                  
                  <Tabs defaultValue={imageTabValue} onValueChange={setImageTabValue}>
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="category">Standaard</TabsTrigger>
                      <TabsTrigger value="upload" disabled={!user?.isPremium}>
                        Uploaden {!user?.isPremium && '🔒'}
                      </TabsTrigger>
                      <TabsTrigger value="auto">Auto Selectie</TabsTrigger>
                    </TabsList>
                    
                    {/* Tab: Standaard categorie afbeeldingen */}
                    <TabsContent value="category" className="py-4">
                      {form.watch('category') ? (
                        <CategoryImageSelector
                          category={form.watch('category') || ''}
                          onSelectImage={handleCategoryImageSelect}
                          defaultImage={form.watch('imageUrl')}
                          title={form.watch('title') || ''}
                          description={form.watch('description') || ''}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-40 bg-muted rounded-md">
                          <p className="text-sm text-muted-foreground">
                            Selecteer eerst een categorie om afbeeldingen te zien
                          </p>
                        </div>
                      )}
                    </TabsContent>
                    
                    {/* Tab: Afbeelding uploaden */}
                    <TabsContent value="upload" className="py-4">
                      {user?.isPremium ? (
                        imagePreviews.length > 0 && imageTabValue === 'upload' ? (
                          <div className="space-y-4">
                            <div className="relative h-60 w-full rounded-md overflow-hidden border">
                              <img 
                                src={imagePreviews[0]} 
                                alt="Geüploade afbeelding" 
                                className="w-full h-full object-cover"
                              />
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                className="absolute top-2 right-2 h-8 w-8 rounded-full"
                                onClick={() => {
                                  setImagePreviews([]);
                                  setSelectedImages([]);
                                  form.setValue('imageUrl', undefined);
                                  form.setValue('imageFile', undefined);
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-60 border-2 border-dashed border-border rounded-md bg-muted/50">
                            <Image className="h-10 w-10 text-muted-foreground/50 mb-2" />
                            <p className="text-sm text-muted-foreground/70 mb-4 text-center">
                              Sleep een afbeelding hierheen of klik om te uploaden
                            </p>
                            <Button
                              variant="outline"
                              type="button"
                              onClick={() => document.getElementById('file-upload')?.click()}
                            >
                              Selecteer afbeelding
                            </Button>
                            <input
                              id="file-upload"
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleImageChange}
                            />
                          </div>
                        )
                      ) : (
                        <div className="flex flex-col items-center justify-center h-60 border-2 border-dashed border-border rounded-md bg-muted/50">
                          <Image className="h-10 w-10 text-muted-foreground/50 mb-2" />
                          <p className="text-sm text-muted-foreground/70 mb-2 text-center">
                            Afbeelding uploaden
                          </p>
                          <p className="text-xs text-muted-foreground/60 mb-4 text-center px-4">
                            Deze functie is alleen beschikbaar voor premium leden
                          </p>
                          <Button
                            variant="outline"
                            type="button"
                            disabled
                            className="opacity-50"
                          >
                            🔒 Premium functie
                          </Button>
                        </div>
                      )}
                    </TabsContent>
                    
                    {/* Tab: Auto Selectie */}
                    <TabsContent value="auto" className="py-4">
                      <AutoImageSelector
                        title={form.watch('title') || ''}
                        category={form.watch('category') || ''}
                        onImageSelected={(imageUrl) => {
                          form.setValue('imageUrl', imageUrl);
                        }}
                        currentImageUrl={form.watch('imageUrl')}
                      />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}
          </form>
        </Form>
      </main>

      {/* Navigatieknoppen onderaan */}
      <div className="fixed bottom-[64px] left-0 right-0 flex gap-4 p-4 bg-background border-t z-10">
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