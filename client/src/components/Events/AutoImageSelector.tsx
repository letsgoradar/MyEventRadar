import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RefreshCw, Check, Sparkles, Undo2 } from "lucide-react";
import { getMatchingImages } from "@/lib/unsplashImageSelector";

interface AutoImageSelectorProps {
  title: string;
  category: string;
  description?: string;
  onImageSelected: (imageUrl: string) => void;
  currentImageUrl?: string;
}

export function AutoImageSelector({
  title,
  category,
  description = '',
  onImageSelected,
  currentImageUrl,
}: AutoImageSelectorProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(currentImageUrl || null);
  const [imageOptions, setImageOptions] = useState<string[]>([]);
  const [allImages, setAllImages] = useState<string[]>([]);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [hasRefreshed, setHasRefreshed] = useState(false);
  const [showingAlternatives, setShowingAlternatives] = useState(false);

  // Genereer automatisch 3 foto opties wanneer titel of beschrijving wijzigen
  useEffect(() => {
    if (title) {
      // Reset state wanneer titel wijzigt
      setHasInitialized(false);
      setHasRefreshed(false);
      setShowingAlternatives(false);
      
      // Async functie om foto's op te halen
      const fetchImages = async () => {
        // Combineer titel en beschrijving voor betere zoekresultaten
        const searchQuery = description ? `${title} ${description}` : title;
        const fetchedImages = await getMatchingImages(searchQuery);
        
        // Bewaar ALLE afbeeldingen
        setAllImages(fetchedImages);
        
        // Toon eerste 3 als opties
        const options = fetchedImages.slice(0, 3);
        setImageOptions(options);
        
        // Selecteer automatisch de eerste als er nog geen image is
        if (!currentImageUrl && options[0]) {
          setSelectedImage(options[0]);
          onImageSelected(options[0]);
        }
        setHasInitialized(true);
      };
      
      fetchImages();
    }
  }, [title, description]); // Luister naar titel EN beschrijving wijzigingen

  const handleRefresh = () => {
    if (hasRefreshed || allImages.length < 6) return;
    
    // Toon afbeelding 4-6 (index 3-5)
    const alternativeOptions = allImages.slice(3, 6);
    setImageOptions(alternativeOptions);
    setHasRefreshed(true);
    setShowingAlternatives(true);
  };

  const handleBackToOriginal = () => {
    // Ga terug naar eerste 3
    const originalOptions = allImages.slice(0, 3);
    setImageOptions(originalOptions);
    setShowingAlternatives(false);
  };

  const handleSelectImage = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    onImageSelected(imageUrl);
  };

  if (!title) {
    return (
      <div className="flex flex-col items-center justify-center h-40 bg-muted rounded-md">
        <Sparkles className="w-8 h-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground text-center px-4">
          Vul eerst een titel in voor automatische foto suggesties
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <p className="text-sm font-medium">
            {showingAlternatives ? 'Alternatieve foto\'s' : 'Automatisch geselecteerde foto\'s'}
          </p>
        </div>
        <div className="flex gap-2">
          {showingAlternatives && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleBackToOriginal}
            >
              <Undo2 className="w-4 h-4 mr-2" />
              Terug
            </Button>
          )}
          {!hasRefreshed && allImages.length >= 6 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRefresh}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Alternatieven
            </Button>
          )}
        </div>
      </div>

      {imageOptions.length > 0 ? (
        <div className="grid grid-cols-3 gap-3">
          {imageOptions.map((imageUrl, index) => (
            <div
              key={index}
              className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                selectedImage === imageUrl
                  ? 'border-primary ring-2 ring-primary/20'
                  : 'border-transparent hover:border-primary/50'
              }`}
              onClick={() => handleSelectImage(imageUrl)}
            >
              <div className="aspect-square">
                <img
                  src={imageUrl}
                  alt={`Optie ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
              {selectedImage === imageUrl && (
                <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                  <Check className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center h-32 bg-muted rounded-md">
          <p className="text-sm text-muted-foreground">
            Foto's worden geladen...
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {showingAlternatives 
          ? 'Klik op een foto om deze te selecteren of klik op \'Terug\' voor de eerste 3 foto\'s.'
          : hasRefreshed 
            ? 'Klik op een foto om deze te selecteren.'
            : 'Klik op een foto om deze te selecteren. Klik op \'Alternatieven\' voor 3 andere suggesties.'
        }
      </p>
    </div>
  );
}
