import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, ImageIcon, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ImageGeneratorProps {
  title: string;
  category: string;
  description?: string;
  onImageGenerated: (imageUrl: string) => void;
}

export function ImageGenerator({
  title,
  category,
  description,
  onImageGenerated,
}: ImageGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isAutoPrompt, setIsAutoPrompt] = useState(true); // Standaard staat auto-prompt aan
  const { toast } = useToast();

  // Generate rich prompt based on event information
  React.useEffect(() => {
    if (title && category && isAutoPrompt) {
      // Maak een rijke, gedetailleerde prompt
      let autoPrompt = `Een professionele foto voor een ${category.toLowerCase()} evenement in Nederland genaamd "${title}"`;
      
      // Locatie en omgeving toevoegen
      const locationWords = ["buiten", "binnen", "park", "zaal", "theater", "centrum", "stad", "natuur", "plein"];
      const randomLocationWord = locationWords[Math.floor(Math.random() * locationWords.length)];
      
      // Sfeer toevoegen
      const moodWords = ["gezellig", "levendig", "warm", "uitnodigend", "energiek", "enthousiast", "ontspannen"];
      const randomMoodWord = moodWords[Math.floor(Math.random() * moodWords.length)];
      
      // Voeg deze elementen toe aan de prompt
      autoPrompt += `, in een ${randomLocationWord} met een ${randomMoodWord} sfeer`;
      
      // Voeg beschrijving toe als die er is
      if (description && description.length > 5) {
        // Extract key phrases from description
        const maxDescriptionLength = 80;
        const descriptionSnippet = description.length > maxDescriptionLength 
          ? description.substring(0, maxDescriptionLength) + "..."
          : description;
        
        autoPrompt += `. Activiteiten omvatten: ${descriptionSnippet}`;
      }
      
      // Voeg enkele visuele details toe op basis van categorie
      if (category === "Sport en spel") {
        autoPrompt += ". Met actieve mensen, sportuitrusting en beweging.";
      } else if (category === "Kunst en Cultuur") {
        autoPrompt += ". Met kunstwerken, expositieruimte en creatieve sfeer.";
      } else if (category === "Gezellig en Sociaal") {
        autoPrompt += ". Met mensen die gezellig samenkomen, eten, drinken en converseren.";
      } else if (category === "Leren en Ontdekken") {
        autoPrompt += ". Met leermaterialen, een educatieve setting en nieuwsgierige deelnemers.";
      } else if (category === "Vrijwilligerswerk en hulp") {
        autoPrompt += ". Met vrijwilligers die samenwerken en anderen helpen.";
      }
      
      // Voeg fotografie-specifieke details toe
      autoPrompt += " Fotografische stijl: heldere belichting, scherpe focus, levendige kleuren, professionele kwaliteit.";
      
      setPrompt(autoPrompt);
    }
  }, [title, category, description, isAutoPrompt]);

  const generateImage = async (retryAttempt = 0) => {
    if (!prompt) {
      toast({
        title: "Voer een prompt in",
        description: "Er is een beschrijving nodig om een afbeelding te genereren",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      // Voeg een timestamp toe om caching te voorkomen
      const response = await fetch(`/api/generate-image?t=${Date.now()}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      const data = await response.json();
      
      // Controleer of het model nog aan het laden is (202 status)
      if (response.status === 202 && data.retry && retryAttempt < 12) {
        // Verschillende berichten bij verschillende fases van retries
        if (retryAttempt === 0) {
          toast({
            title: "AI-model wordt geladen",
            description: data.message || "Even geduld terwijl we het model laden, dit kan even duren...",
            duration: 8000,
          });
        } else if (retryAttempt === 5) {
          // Extra feedback halfweg de pogingen
          toast({
            title: "Model wordt nog steeds geladen",
            description: "We blijven proberen... Dit kan tot 1 minuut duren bij het eerste gebruik.",
            duration: 8000,
          });
        } else if (retryAttempt === 9) {
          // Laatste waarschuwing
          toast({
            title: "Laatste pogingen",
            description: "Het duurt wat langer dan verwacht. We doen nog enkele pogingen...",
            duration: 8000,
          });
        }
        
        // Bepaal wachttijd, verhoog geleidelijk voor betere prestaties
        // Eerste pogingen: korte wachttijden, latere pogingen: langere wachttijden
        let waitTime = 5000; // standaard 5 seconden
        if (retryAttempt < 4) {
          waitTime = 5000;
        } else if (retryAttempt < 8) {
          waitTime = 8000;
        } else {
          waitTime = 10000; // Langere wachttijden bij latere pogingen
        }
        
        // Automatisch opnieuw proberen met logging
        console.log(`Wachten op AI model (poging ${retryAttempt + 1}/12)... Volgende poging over ${waitTime/1000} seconden`);
        setTimeout(() => {
          generateImage(retryAttempt + 1);
        }, waitTime);
        return;
      }
      
      // Bij niet-retryable fouten
      if (!response.ok) {
        // Als er een API error is (buiten timeout/retry), toon duidelijk bericht
        if (data.error) {
          console.error("API error:", data.error);
          
          // Check voor specifieke fouten zoals payload te groot
          if (response.status === 413 || (data.error && data.error.includes("too large"))) {
            toast({
              title: "Afbeelding te groot",
              description: "De gegenereerde afbeelding is te groot. Probeer een kortere prompt te gebruiken of wacht even voor een nieuwe poging.",
              variant: "destructive",
              duration: 8000,
            });
          } else {
            toast({
              title: "Afbeeldingsgeneratie niet beschikbaar",
              description: data.message || "Er is een probleem met de afbeeldingsgeneratie. Probeer het later opnieuw.",
              variant: "destructive",
              duration: 5000,
            });
          }
          throw new Error(data.error);
        }
        throw new Error("Failed to generate image");
      }

      // Als we hier zijn, hebben we een succesvolle afbeelding gegenereerd
      // Controleer of we een imageUrl hebben ontvangen
      if (!data.imageUrl) {
        throw new Error("No image URL received");
      }

      // Update de afbeelding met wat er is teruggekomen
      setGeneratedImage(data.imageUrl);
      onImageGenerated(data.imageUrl);
      
      // Toon een succesmelding
      toast({
        title: "Afbeelding gegenereerd",
        description: "Een afbeelding is toegevoegd aan je evenement via Hugging Face AI",
        variant: "default",
      });
    } catch (error) {
      console.error("Error generating image:", error);
      toast({
        title: "Fout bij genereren",
        description: "Er is een fout opgetreden bij het genereren van de afbeelding",
        variant: "destructive",
      });
    } finally {
      if (retryAttempt === 0 || retryAttempt >= 12) {
        setIsGenerating(false);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-medium">Genereer een afbeelding met AI</h3>
          <div className="flex items-center gap-2">
            <Switch 
              checked={isAutoPrompt}
              onCheckedChange={setIsAutoPrompt}
              id="auto-prompt"
            />
            <label 
              htmlFor="auto-prompt"
              className="text-sm text-muted-foreground cursor-pointer"
            >
              Auto-prompt
            </label>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {isAutoPrompt 
            ? "Een optimale prompt is automatisch gegenereerd op basis van je evenementgegevens. De afbeelding wordt vierkant gegenereerd voor optimale weergave in de evenementlijst."
            : "Beschrijf zelf de gewenste afbeelding voor je evenement. De afbeelding wordt vierkant gegenereerd."}
        </p>
      </div>

      <div className="relative">
        <Textarea
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            // Als de gebruiker handmatig typt, schakel auto-prompt uit
            if (isAutoPrompt && e.target.value !== prompt) {
              setIsAutoPrompt(false);
            }
          }}
          placeholder="Beschrijf de afbeelding die je wilt genereren..."
          className="min-h-[100px] pr-20"
        />
        {title && category && !isAutoPrompt && (
          <Button
            size="sm"
            variant="ghost"
            className="absolute right-2 top-2"
            onClick={() => setIsAutoPrompt(true)}
            title="Herstel automatische prompt"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex flex-col space-y-4">
        <Button
          onClick={() => generateImage()}
          disabled={isGenerating || !prompt}
          className="w-full"
          size="lg"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Bezig met genereren...
            </>
          ) : (
            <>
              <ImageIcon className="mr-2 h-5 w-5" />
              Genereer afbeelding
            </>
          )}
        </Button>

        {generatedImage && (
          <div className="relative aspect-square w-full max-w-[300px] mx-auto rounded-md overflow-hidden mt-4 border">
            <img
              src={generatedImage}
              alt="Generated event image"
              className="w-full h-full object-cover"
            />
            <Button 
              variant="outline"
              size="sm"
              className="absolute bottom-2 right-2 bg-background opacity-80 hover:opacity-100"
              onClick={() => generateImage()}
              disabled={isGenerating}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Nieuwe versie
            </Button>
          </div>
        )}

        {isGenerating && (
          <div className="text-center text-sm space-y-2">
            <div className="text-muted-foreground space-y-1">
              <p>Het kan 15-45 seconden duren om een afbeelding te genereren</p>
              <p>Bij eerste gebruik moet het AI model geladen worden (tot 2 minuten)</p>
              <p>De afbeelding wordt rechtstreeks gegenereerd door Hugging Face AI</p>
            </div>
            
            <div className="flex flex-col items-center justify-center gap-1 pt-2">
              <div className="animate-pulse flex space-x-2">
                <div className="h-2 w-2 bg-blue-600 rounded-full"></div>
                <div className="h-2 w-2 bg-blue-600 rounded-full animation-delay-200"></div>
                <div className="h-2 w-2 bg-blue-600 rounded-full animation-delay-400"></div>
              </div>
              <p className="text-xs text-blue-600 font-medium mt-1">Afbeelding wordt gegenereerd...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}