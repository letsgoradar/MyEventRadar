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
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);

  // Bij verandering van categorie of titel, genereer nieuwe afbeeldingen
  useEffect(() => {
    if (category) {
      generateImagesForCategory();
    }
  }, [category, title]);

  // Genereer 5 verschillende variaties van SVG illustraties voor deze categorie
  const generateImagesForCategory = () => {
    if (!category) return;
    
    // Genereer 5 verschillende illustraties met kleine variaties
    const images = [
      generateSVGForCategory(category, title),
      generateSVGForCategory(category, title + " - Variant 2"),
      generateSVGForCategory(category, title + " - Variant 3"),
      generateSVGForCategory(category, title + " - Variant 4"),
      generateSVGForCategory(category, title + " - Variant 5"),
    ];
    
    setGeneratedImages(images);
    setCurrentImageIndex(0);
    
    // Selecteer automatisch de eerste afbeelding
    onImageSelected(images[0]);
  };

  // Navigeer naar de volgende afbeelding
  const nextImage = () => {
    if (generatedImages.length === 0) return;
    
    const nextIndex = (currentImageIndex + 1) % generatedImages.length;
    setCurrentImageIndex(nextIndex);
    onImageSelected(generatedImages[nextIndex]);
  };

  // Navigeer naar de vorige afbeelding
  const prevImage = () => {
    if (generatedImages.length === 0) return;
    
    const prevIndex = (currentImageIndex - 1 + generatedImages.length) % generatedImages.length;
    setCurrentImageIndex(prevIndex);
    onImageSelected(generatedImages[prevIndex]);
  };

  // Als er geen categorie is, toon een melding
  if (!category) {
    return (
      <div className="flex items-center justify-center h-60 border-2 border-dashed border-border rounded-md">
        <p className="text-muted-foreground text-center">
          Selecteer eerst een categorie om automatisch relevante afbeeldingen te zien
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Titel voor de afbeelding sectie */}
      <div>
        <h3 className="text-base font-medium">Afbeelding</h3>
        <p className="text-sm text-muted-foreground">
          Hier wordt automatisch een passende afbeelding voor je evenement getoond
        </p>
      </div>

      {/* Toon geselecteerde afbeelding met navigatie knoppen */}
      {generatedImages.length > 0 && (
        <div className="relative">
          <div className="relative h-60 w-full rounded-md overflow-hidden border">
            <img
              src={generatedImages[currentImageIndex]}
              alt={`${category} afbeelding`}
              className="w-full h-full object-cover"
            />
          </div>
          
          {/* Navigatie knoppen */}
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
        </div>
      )}

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