import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ImageIcon, RefreshCw } from "lucide-react";
import { CATEGORIES } from '@shared/schema';
import { generateSVGForCategory } from '@/lib/categoryImages';

interface CategoryImageSelectorProps {
  title: string;
  category: typeof CATEGORIES[number];
  onImageSelected: (imageUrl: string) => void;
}

export function CategoryImageSelector({
  title,
  category,
  onImageSelected,
}: CategoryImageSelectorProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);

  // Bij verandering van categorie of titel, genereer nieuwe afbeeldingen
  useEffect(() => {
    if (category) {
      generateImagesForCategory();
    }
  }, [category, title]);

  // Genereer 3 verschillende variaties van SVG illustraties voor deze categorie
  const generateImagesForCategory = () => {
    // Genereer 3 verschillende illustraties met kleine variaties
    const images = [
      generateSVGForCategory(category, title),
      generateSVGForCategory(category, title + " - Variant 2"),
      generateSVGForCategory(category, title + " - Variant 3"),
    ];
    
    setGeneratedImages(images);
    
    // Als er geen geselecteerde afbeelding is, selecteer automatisch de eerste
    if (!selectedImage) {
      setSelectedImage(images[0]);
      onImageSelected(images[0]);
    }
  };

  // Selecteer een afbeelding
  const handleSelectImage = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    onImageSelected(imageUrl);
  };

  // Als er geen categorie is, toon een melding
  if (!category) {
    return (
      <div className="flex items-center justify-center h-60 border-2 border-dashed border-border rounded-md">
        <p className="text-muted-foreground text-center">
          Selecteer eerst een categorie om afbeeldingen te zien
        </p>
      </div>
    );
  }

  return (
    <Card className="mb-4">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium mb-2">Kies een afbeelding voor je evenement</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Selecteer een van de onderstaande afbeeldingen of genereer nieuwe varianten
            </p>
          </div>

          {/* Toon de gegenereerde afbeeldingen */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {generatedImages.map((imageUrl, index) => (
              <div 
                key={index}
                className={`
                  relative cursor-pointer border-2 rounded-md overflow-hidden h-40
                  ${selectedImage === imageUrl ? 'border-primary' : 'border-border'}
                `}
                onClick={() => handleSelectImage(imageUrl)}
              >
                <img 
                  src={imageUrl} 
                  alt={`${category} afbeelding ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>

          {/* Genereer nieuwe afbeeldingen button */}
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={generateImagesForCategory}
              className="mt-2"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Nieuwe varianten
            </Button>
          </div>

          {/* Toon geselecteerde afbeelding */}
          {selectedImage && (
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">Geselecteerde afbeelding:</h4>
              <div className="relative h-60 w-full rounded-md overflow-hidden border">
                <img
                  src={selectedImage}
                  alt="Geselecteerde evenement afbeelding"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}