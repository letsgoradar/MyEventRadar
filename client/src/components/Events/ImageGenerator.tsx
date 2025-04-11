import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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
  const { toast } = useToast();

  // Generate default prompt based on event information
  React.useEffect(() => {
    if (title && category) {
      let defaultPrompt = `Een foto van een ${category.toLowerCase()} evenement getiteld "${title}"`;
      if (description) {
        // Voeg de eerste 100 karakters van de beschrijving toe aan de prompt als die bestaat
        defaultPrompt += `, ${description.substring(0, 100)}`;
      }
      setPrompt(defaultPrompt);
    }
  }, [title, category, description]);

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
    <Card className="mb-4">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium mb-2">Genereer een afbeelding met AI</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Beschrijf de gewenste afbeelding voor je evenement en laat de AI deze genereren
            </p>
          </div>

          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Beschrijf de afbeelding die je wilt genereren..."
            className="min-h-[100px]"
          />

          <div className="flex items-center space-x-2">
            <Button
              onClick={generateImage}
              disabled={isGenerating || !prompt}
              className="flex-1"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Bezig met genereren...
                </>
              ) : (
                <>
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Genereer afbeelding
                </>
              )}
            </Button>
            {generatedImage && (
              <Button
                variant="outline"
                onClick={() => generateImage()}
                disabled={isGenerating}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
          </div>

          {generatedImage && (
            <div className="relative h-60 w-full rounded-md overflow-hidden mt-4 border">
              <img
                src={generatedImage}
                alt="Generated event image"
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}