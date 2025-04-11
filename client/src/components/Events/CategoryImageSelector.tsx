import React from 'react';
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { CATEGORIES } from '@shared/schema';

interface CategoryImageSelectorProps {
  title: string;
  category: typeof CATEGORIES[number] | null;
  onImageSelected: (imageUrl: string) => void;
  onUploadClick?: () => void;
}

export function CategoryImageSelector({
  category,
  onImageSelected,
  onUploadClick
}: CategoryImageSelectorProps) {
  // Standaard afbeeldingen per categorie zonder generatie
  const getCategoryImage = (category: typeof CATEGORIES[number]): string => {
    switch(category) {
      case 'Sport en spel':
        return '/images/categories/sport-1.svg';
      case 'Kunst en Cultuur':
        return '/images/categories/kunst-1.svg';
      case 'Gezellig en Sociaal':
        return '/images/categories/sociaal-1.svg';
      case 'Leren en Ontdekken':
        return '/images/categories/leren-1.svg';
      case 'Vrijwilligerswerk en hulp':
        return '/images/categories/vrijwilligers-1.svg';
      default:
        return '/images/event-logo.svg';
    }
  };

  // Toen een standaard afbeelding als categorie is geselecteerd
  if (category) {
    const imageUrl = getCategoryImage(category);
    // Informeer het bovenliggende component over de geselecteerde afbeelding
    React.useEffect(() => {
      onImageSelected(imageUrl);
    }, [category, imageUrl, onImageSelected]);

    return (
      <div className="space-y-4">
        {/* Toon de standaard afbeelding voor deze categorie */}
        <div className="relative">
          <div className="relative h-60 w-full rounded-md overflow-hidden border">
            <img
              src={imageUrl}
              alt={`${category} afbeelding`}
              className="w-full h-full object-cover"
            />
          </div>
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

  // Als nog geen categorie is geselecteerd
  return (
    <div className="flex items-center justify-center h-60 border-2 border-dashed border-border rounded-md">
      <p className="text-muted-foreground text-center">
        Selecteer eerst een categorie om een passende afbeelding te zien
      </p>
    </div>
  );
}