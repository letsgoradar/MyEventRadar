import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getCategoryImages } from '@/lib/categoryImages';
import { getSmartImage, getSmartImageAlternatives, ALL_ACTIVITY_IMAGES } from '@/lib/smartImageSelection';
import { ChevronRight, ChevronLeft } from 'lucide-react';

interface CategoryImageSelectorProps {
  category: string; // Alleen nog voor backwards compatibility
  onSelectImage: (imageUrl: string) => void;
  defaultImage?: string;
  title?: string;
  description?: string;
  onSuggestAIGeneration?: () => void; // Callback voor AI generatie suggestie
}

export function CategoryImageSelector({ 
  category, 
  onSelectImage, 
  defaultImage,
  title = "",
  description = "",
  onSuggestAIGeneration
}: CategoryImageSelectorProps) {
  const [images, setImages] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | undefined>(defaultImage);

  // Laad slimme afbeelding alternatieven gebaseerd op titel en beschrijving
  useEffect(() => {
    if (title || description) {
      // Gebruik slimme selectie voor 8 relevante alternatieven
      const smartAlternatives = getSmartImageAlternatives(title, description, 8);
      
      if (smartAlternatives.hasMatch && smartAlternatives.images.length > 0) {
        // Gevonden matches - toon relevante alternatieven
        setImages(smartAlternatives.images);
        
        // Gebruik primaire afbeelding als selectie
        if (smartAlternatives.primaryImage) {
          setSelectedImage(smartAlternatives.primaryImage);
          onSelectImage(smartAlternatives.primaryImage);
          console.log(`Slimme afbeelding selectie voor "${title}": ${smartAlternatives.primaryImage}`);
          console.log(`${smartAlternatives.images.length} relevante alternatieven geladen`);
        }
      } else {
        // Geen match - gebruik eerste 8 algemene afbeeldingen en suggereer AI generatie
        setImages(ALL_ACTIVITY_IMAGES.slice(0, 8));
        setSelectedImage(undefined);
        if (onSuggestAIGeneration) {
          onSuggestAIGeneration();
        }
        console.log(`Geen passende afbeelding voor "${title}" - AI generatie voorgesteld`);
      }
    } else {
      // Geen titel/beschrijving - toon eerste 8 algemene afbeeldingen
      setImages(ALL_ACTIVITY_IMAGES.slice(0, 8));
    }
  }, [title, description]);

  // Als er geen afbeeldingen zijn geladen
  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 bg-muted rounded-md">
        <p className="text-sm text-muted-foreground">
          Afbeeldingen worden geladen...
        </p>
      </div>
    );
  }

  const handleSelectImage = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    onSelectImage(imageUrl);
  };

  return (
    <div className="space-y-4">
      {/* Toon geselecteerde afbeelding of AI suggestie */}
      {selectedImage ? (
        <div className="relative h-60 w-full rounded-md overflow-hidden border">
          <img 
            src={selectedImage} 
            alt="Geselecteerde afbeelding" 
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-60 bg-muted rounded-md border border-dashed">
          <p className="text-sm text-muted-foreground mb-2">
            Geen passende afbeelding gevonden
          </p>
          <p className="text-xs text-muted-foreground text-center px-4">
            Gebruik AI Genereren voor een aangepaste afbeelding
          </p>
        </div>
      )}

      {/* Horizontale lijst met beschikbare afbeeldingen */}
      <ScrollArea className="relative h-[120px]">
        <div className="flex space-x-2 p-1">
          {images.map((imageUrl, index) => (
            <div 
              key={index}
              className={`flex-shrink-0 relative rounded-md overflow-hidden cursor-pointer border-2 
                ${selectedImage === imageUrl ? 'border-primary' : 'border-transparent'}`}
              onClick={() => handleSelectImage(imageUrl)}
            >
              <img 
                src={imageUrl} 
                alt={`Categorie afbeelding ${index + 1}`} 
                className="w-24 h-24 object-cover"
              />
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export default CategoryImageSelector;