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
    console.log('CategoryImageSelector: Effect triggered', { title, description });
    
    if (title || description) {
      // Gebruik slimme selectie voor 8 relevante alternatieven
      const smartAlternatives = getSmartImageAlternatives(title, description, 8);
      console.log('Smart alternatives result:', smartAlternatives);
      
      if (smartAlternatives.hasMatch && smartAlternatives.images.length > 0) {
        // Gevonden matches - toon relevante alternatieven
        setImages(smartAlternatives.images);
        console.log('Setting images to smart alternatives:', smartAlternatives.images.length);
        
        // Gebruik primaire afbeelding als selectie
        if (smartAlternatives.primaryImage) {
          setSelectedImage(smartAlternatives.primaryImage);
          // Use setTimeout to prevent callback from triggering re-renders
          setTimeout(() => {
            if (smartAlternatives.primaryImage) {
              onSelectImage(smartAlternatives.primaryImage);
            }
          }, 0);
          console.log(`Slimme afbeelding selectie voor "${title}": ${smartAlternatives.primaryImage}`);
          console.log(`${smartAlternatives.images.length} relevante alternatieven geladen`);
        }
      } else {
        // Geen match - gebruik eerste 8 algemene afbeeldingen en suggereer AI generatie
        const fallbackImages = ALL_ACTIVITY_IMAGES.slice(0, 8);
        setImages(fallbackImages);
        console.log('No smart matches, using fallback images:', fallbackImages.length);
        setSelectedImage(undefined);
        if (onSuggestAIGeneration) {
          onSuggestAIGeneration();
        }
        console.log(`Geen passende afbeelding voor "${title}" - AI generatie voorgesteld`);
      }
    } else {
      // Geen titel/beschrijving - toon eerste 8 algemene afbeeldingen
      const defaultImages = ALL_ACTIVITY_IMAGES.slice(0, 8);
      setImages(defaultImages);
      console.log('No title/description, using default images:', defaultImages.length);
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
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Kies een passende afbeelding ({images.length} opties):
        </p>
        <ScrollArea className="w-full">
          <div className="flex space-x-3 pb-4">
            {images.filter(imageUrl => imageUrl && typeof imageUrl === 'string').map((imageUrl, index) => (
              <div 
                key={`image-${index}-${imageUrl.substring(imageUrl.length - 10)}`}
                className={`flex-shrink-0 relative rounded-lg overflow-hidden cursor-pointer border-2 transition-all duration-200 hover:scale-105
                  ${selectedImage === imageUrl ? 'border-primary ring-2 ring-primary/20' : 'border-muted-foreground/20 hover:border-primary/50'}`}
                onClick={() => handleSelectImage(imageUrl)}
              >
                <img 
                  src={`${imageUrl}?auto=format&fit=crop&w=200&h=200`} 
                  alt={`Optie ${index + 1}`} 
                  className="w-20 h-20 sm:w-24 sm:h-24 object-cover"
                  loading="lazy"
                  onError={(e) => {
                    console.error(`Afbeelding ${index + 1} laadprobleem:`, imageUrl);
                    const target = e.currentTarget;
                    // Probeer fallback URL
                    if (!target.src.includes('placeholder')) {
                      target.src = `https://via.placeholder.com/200x200/e5e7eb/6b7280?text=Afbeelding+${index + 1}`;
                    }
                  }}
                  onLoad={() => {
                    console.log(`✓ Afbeelding ${index + 1} geladen`);
                  }}
                />
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

export default CategoryImageSelector;