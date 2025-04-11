import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Upload } from "lucide-react";
import { CATEGORIES } from '@shared/schema';
import { generateSVGForCategory } from '@/lib/categoryImages';

interface CategoryImageSelectorProps {
  title: string;
  category: typeof CATEGORIES[number] | null;
  onImageSelected: (imageUrl: string) => void;
  onUploadClick?: () => void;
}

export function CategoryImageSelector({
  title,
  category,
  onImageSelected,
  onUploadClick
}: CategoryImageSelectorProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const [images, setImages] = useState<string[]>([]);

  // Bij verandering van categorie, genereer nieuwe afbeeldingsvarianten
  useEffect(() => {
    if (category) {
      // We gebruiken nu de SVG generator voor 5 varianten
      const generatedImages = [
        generateSVGForCategory(category, title + " - Style 1"),
        generateSVGForCategory(category, title + " - Style 2"),
        generateSVGForCategory(category, title + " - Style 3"),
        generateSVGForCategory(category, title + " - Style 4"),
        generateSVGForCategory(category, title + " - Style 5"),
      ];
      
      setImages(generatedImages);
      setCurrentImageIndex(0);
      
      // Selecteer automatisch de eerste afbeelding
      if (generatedImages.length > 0) {
        onImageSelected(generatedImages[0]);
      }
    }
  }, [category, title, onImageSelected]);

  // Navigeer naar de volgende afbeelding
  const nextImage = () => {
    if (images.length === 0) return;
    
    const nextIndex = (currentImageIndex + 1) % images.length;
    setCurrentImageIndex(nextIndex);
    onImageSelected(images[nextIndex]);
  };

  // Navigeer naar de vorige afbeelding
  const prevImage = () => {
    if (images.length === 0) return;
    
    const prevIndex = (currentImageIndex - 1 + images.length) % images.length;
    setCurrentImageIndex(prevIndex);
    onImageSelected(images[prevIndex]);
  };

  // Als er geen categorie is geselecteerd, toon een melding
  if (!category) {
    return (
      <div className="flex items-center justify-center h-60 border-2 border-dashed border-border rounded-md">
        <p className="text-muted-foreground text-center">
          Selecteer eerst een categorie om relevante afbeeldingen te zien
        </p>
      </div>
    );
  }

  // Als er geen afbeeldingen beschikbaar zijn voor deze categorie
  if (images.length === 0) {
    return (
      <div className="flex items-center justify-center h-60 border-2 border-dashed border-border rounded-md">
        <p className="text-muted-foreground text-center">
          Geen afbeeldingen beschikbaar voor {category}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Afbeelding met navigatie knoppen */}
      <div className="relative">
        <div className="relative h-60 w-full rounded-md overflow-hidden border">
          <img
            src={images[currentImageIndex]}
            alt={`${category} afbeelding`}
            className="w-full h-full object-cover"
          />
        </div>
        
        {/* Navigatieknoppen alleen tonen als er meerdere afbeeldingen zijn */}
        {images.length > 1 && (
          <>
            <div className="absolute inset-y-0 left-0 flex items-center">
              <Button 
                onClick={prevImage} 
                variant="secondary"
                size="icon"
                className="h-8 w-8 rounded-full bg-white bg-opacity-80 shadow-md ml-2"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="absolute inset-y-0 right-0 flex items-center">
              <Button 
                onClick={nextImage} 
                variant="secondary"
                size="icon"
                className="h-8 w-8 rounded-full bg-white bg-opacity-80 shadow-md mr-2"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Upload eigen afbeelding optie */}
      {onUploadClick && (
        <Button
          variant="outline"
          onClick={onUploadClick}
          className="w-full flex justify-center items-center"
          type="button"
        >
          <Upload className="mr-2 h-4 w-4" />
          Eigen afbeelding uploaden
        </Button>
      )}
    </div>
  );
}