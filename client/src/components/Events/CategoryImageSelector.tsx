import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getCategoryImages } from '@/lib/categoryImages';
import { ChevronRight, ChevronLeft } from 'lucide-react';

interface CategoryImageSelectorProps {
  category: string;
  onSelectImage: (imageUrl: string) => void;
  defaultImage?: string;
}

export function CategoryImageSelector({ 
  category, 
  onSelectImage, 
  defaultImage 
}: CategoryImageSelectorProps) {
  const [images, setImages] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | undefined>(defaultImage);

  // Laad afbeeldingen bij eerste render en wanneer de categorie verandert
  useEffect(() => {
    if (category) {
      const categoryImages = getCategoryImages(category);
      setImages(categoryImages);
      
      // Als er nog geen geselecteerde afbeelding is, neem de eerste van de categorie
      if (!selectedImage && categoryImages.length > 0) {
        setSelectedImage(categoryImages[0]);
        onSelectImage(categoryImages[0]);
      }
    }
  }, [category]);

  // Effect voor als de categorie verandert, update dan ook de geselecteerde afbeelding
  useEffect(() => {
    if (category && (!selectedImage || !images.includes(selectedImage))) {
      const categoryImages = getCategoryImages(category);
      if (categoryImages.length > 0) {
        setSelectedImage(categoryImages[0]);
        onSelectImage(categoryImages[0]);
      }
    }
  }, [category, selectedImage, images]);

  // Als er geen categorie is gekozen of er zijn geen afbeeldingen
  if (!category || images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 bg-muted rounded-md">
        <p className="text-sm text-muted-foreground">
          Selecteer eerst een categorie om afbeeldingen te zien
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
      {/* Toon geselecteerde afbeelding */}
      {selectedImage && (
        <div className="relative h-60 w-full rounded-md overflow-hidden border">
          <img 
            src={selectedImage} 
            alt="Geselecteerde afbeelding" 
            className="w-full h-full object-cover"
          />
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