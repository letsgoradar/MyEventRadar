import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { getCategoryImages } from '@/lib/categoryImages';
import { getSmartImage, getSmartImageAlternatives, ALL_ACTIVITY_IMAGES, searchImagesByKeyword } from '@/lib/smartImageSelection';
import { ChevronRight, ChevronLeft, Search } from 'lucide-react';

interface CategoryImageSelectorProps {
  category?: string; // Niet meer gebruikt, alleen backwards compatibility
  onSelectImage: (imageUrl: string) => void;
  defaultImage?: string;
  title?: string;
  description?: string; // Niet meer gebruikt
}

export function CategoryImageSelector({ 
  category, 
  onSelectImage, 
  defaultImage,
  title = "",
  description = ""
}: CategoryImageSelectorProps) {
  const [images, setImages] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | undefined>(defaultImage);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isManualSearch, setIsManualSearch] = useState<boolean>(false);

  // Laad slimme afbeelding alternatieven gebaseerd op ALLEEN titel (niet beschrijving)
  useEffect(() => {
    // Skip als gebruiker handmatig aan het zoeken is
    if (isManualSearch) return;
    
    console.log('CategoryImageSelector: Effect triggered', { title });
    
    if (title) {
      // Gebruik slimme selectie voor 8 relevante alternatieven - ALLEEN gebaseerd op titel
      const smartAlternatives = getSmartImageAlternatives(title, "", 8); // Lege string voor description!
      console.log('Smart alternatives result (title only):', smartAlternatives);
      
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
        // Geen match - gebruik eerste 8 algemene afbeeldingen
        const fallbackImages = ALL_ACTIVITY_IMAGES.slice(0, 8);
        setImages(fallbackImages);
        console.log('No smart matches, using fallback images:', fallbackImages.length);
        setSelectedImage(undefined);
        console.log(`Geen passende afbeelding voor "${title}" - gebruik handmatig zoeken`);
      }
    } else {
      // Geen titel - toon eerste 8 algemene afbeeldingen
      const defaultImages = ALL_ACTIVITY_IMAGES.slice(0, 8);
      setImages(defaultImages);
      console.log('No title, using default images:', defaultImages.length);
    }
  }, [title]); // Alleen title, niet description!
  
  // Handmatige zoekfunctie
  const handleSearch = (term: string) => {
    setSearchTerm(term);
    
    if (term.trim() === "") {
      // Leeg zoekveld - terug naar automatische selectie
      setIsManualSearch(false);
      return;
    }
    
    setIsManualSearch(true);
    const searchResults = searchImagesByKeyword(term, 24); // Toon meer resultaten bij zoeken
    setImages(searchResults.images);
    
    if (!searchResults.hasMatch) {
      console.log(`Geen afbeeldingen gevonden voor zoekterm "${term}"`);
    } else {
      console.log(`${searchResults.images.length} afbeeldingen gevonden voor zoekterm "${term}"`);
    }
  };

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
            Zoek hieronder naar een passende afbeelding
          </p>
        </div>
      )}

      {/* Zoekveld voor handmatig zoeken */}
      <div className="space-y-2">
        <p className="text-sm font-medium">
          Zoek afbeelding op trefwoord
        </p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Bijv: voetbal, muziek, koken, yoga..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        {isManualSearch && searchTerm && (
          <p className="text-xs text-muted-foreground">
            {images.length} afbeeldingen gevonden voor "{searchTerm}"
          </p>
        )}
      </div>

      {/* Horizontale lijst met beschikbare afbeeldingen */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {isManualSearch ? "Zoekresultaten:" : `Aanbevolen afbeeldingen (${images.length} opties):`}
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