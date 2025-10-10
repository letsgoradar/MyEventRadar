import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RefreshCw, Check, Sparkles } from "lucide-react";
import { getMatchingImages } from "@/lib/unsplashImageSelector";

interface AutoImageSelectorProps {
  title: string;
  category: string;
  onImageSelected: (imageUrl: string) => void;
  currentImageUrl?: string;
}

export function AutoImageSelector({
  title,
  category,
  onImageSelected,
  currentImageUrl,
}: AutoImageSelectorProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(currentImageUrl || null);
  const [imageOptions, setImageOptions] = useState<string[]>([]);

  // Genereer automatisch 3 foto opties
  useEffect(() => {
    if (title && category) {
      const allMatchingImages = getMatchingImages(title, category);
      // Take first 3 images from matching set
      const options = allMatchingImages.slice(0, 3);
      setImageOptions(options);
      
      // Selecteer automatisch de eerste als er nog geen image is
      if (!selectedImage && options[0]) {
        setSelectedImage(options[0]);
        onImageSelected(options[0]);
      }
    }
  }, [title, category]);

  const handleRefresh = () => {
    const allMatchingImages = getMatchingImages(title, category);
    // Shuffle the array to get different images on refresh
    const shuffled = [...allMatchingImages].sort(() => Math.random() - 0.5);
    const newOptions = shuffled.slice(0, 3);
    setImageOptions(newOptions);
  };

  const handleSelectImage = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    onImageSelected(imageUrl);
  };

  if (!title || !category) {
    return (
      <div className="flex flex-col items-center justify-center h-40 bg-muted rounded-md">
        <Sparkles className="w-8 h-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground text-center px-4">
          Vul eerst een titel en categorie in voor automatische foto suggesties
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
            Automatisch geselecteerde foto's
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleRefresh}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Ververs
        </Button>
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
        Klik op een foto om deze te selecteren. Klik op 'Ververs' voor nieuwe suggesties.
      </p>
    </div>
  );
}
