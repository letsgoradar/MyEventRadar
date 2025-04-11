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

  const generateImage = async () => {
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
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate image");
      }

      const data = await response.json();
      setGeneratedImage(data.imageUrl);
      onImageGenerated(data.imageUrl);
      
      toast({
        title: "Afbeelding gegenereerd",
        description: "De AI heeft een afbeelding voor je evenement gemaakt",
      });
    } catch (error) {
      console.error("Error generating image:", error);
      toast({
        title: "Fout bij genereren",
        description: "Er is een fout opgetreden bij het genereren van de afbeelding",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
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
            ? "Een optimale prompt is automatisch gegenereerd op basis van je evenementgegevens"
            : "Beschrijf zelf de gewenste afbeelding voor je evenement"}
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
          onClick={generateImage}
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
          <div className="relative h-60 w-full rounded-md overflow-hidden mt-4 border">
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
          <div className="text-center text-sm text-muted-foreground">
            <p>Het kan tot 10-15 seconden duren om een afbeelding te genereren</p>
          </div>
        )}
      </div>
    </div>
  );
}