import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Check, Search, Loader2 } from "lucide-react";
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
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState(title);
  const [lastSearchedQuery, setLastSearchedQuery] = useState("");

  const fetchImages = useCallback(async (query: string) => {
    if (!query.trim()) return;
    
    setIsLoading(true);
    try {
      const fetchedImages = await getMatchingImages(query);
      setImageOptions(fetchedImages);
      setLastSearchedQuery(query);
      
      if (!currentImageUrl && fetchedImages[0]) {
        setSelectedImage(fetchedImages[0]);
        onImageSelected(fetchedImages[0]);
      }
    } catch (error) {
      console.error("Fout bij ophalen afbeeldingen:", error);
    } finally {
      setIsLoading(false);
    }
  }, [currentImageUrl, onImageSelected]);

  useEffect(() => {
    if (title && title !== searchQuery) {
      setSearchQuery(title);
    }
  }, [title]);

  useEffect(() => {
    if (searchQuery && searchQuery !== lastSearchedQuery) {
      const timeoutId = setTimeout(() => {
        fetchImages(searchQuery);
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [searchQuery, lastSearchedQuery, fetchImages]);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      fetchImages(searchQuery);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleSelectImage = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    onImageSelected(imageUrl);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Zoek afbeeldingen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-9"
            data-testid="input-image-search"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleSearch}
          disabled={isLoading || !searchQuery.trim()}
          data-testid="button-search-images"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32 bg-muted rounded-md">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Afbeeldingen zoeken...</span>
        </div>
      ) : imageOptions.length > 0 ? (
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
              data-testid={`image-option-${index}`}
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
      ) : searchQuery ? (
        <div className="flex flex-col items-center justify-center h-32 bg-muted rounded-md">
          <Search className="w-8 h-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground text-center px-4">
            Geen afbeeldingen gevonden. Probeer een andere zoekterm.
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-32 bg-muted rounded-md">
          <Search className="w-8 h-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground text-center px-4">
            Vul een zoekterm in om afbeeldingen te zoeken
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Zoek afbeeldingen op basis van een trefwoord. De zoekterm is vooraf ingevuld met de titel van je evenement.
      </p>
    </div>
  );
}
