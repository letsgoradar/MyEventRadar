import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Search, Loader2, RefreshCw, Sparkles } from 'lucide-react';

interface CategoryImageSelectorProps {
  category?: string;
  onSelectImage: (imageUrl: string) => void;
  defaultImage?: string;
  title?: string;
  description?: string;
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
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastSearchedQuery, setLastSearchedQuery] = useState<string>("");
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [isGeneratingTerm, setIsGeneratingTerm] = useState<boolean>(false);
  
  const [usedSearchTerms, setUsedSearchTerms] = useState<string[]>([]);
  const [currentSearchTerm, setCurrentSearchTerm] = useState<string>("");
  const initialSearchDone = useRef(false);

  const generateSearchTerm = useCallback(async (eventTitle: string, excludeTerms: string[] = []): Promise<string> => {
    setIsGeneratingTerm(true);
    try {
      const response = await fetch('/api/generate-search-term', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: eventTitle, excludeTerms }),
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`AI zoekterm gegenereerd: "${data.searchTerm}" (bron: ${data.source})`);
        return data.searchTerm;
      }
    } catch (error) {
      console.error('Fout bij genereren zoekterm:', error);
    } finally {
      setIsGeneratingTerm(false);
    }
    return eventTitle;
  }, []);

  useEffect(() => {
    if (title && !initialSearchDone.current) {
      initialSearchDone.current = true;
      generateSearchTerm(title, []).then(term => {
        setSearchQuery(term);
        setCurrentSearchTerm(term);
        setUsedSearchTerms([term]);
      });
    }
  }, [title, generateSearchTerm]);

  const fetchUnsplashImages = useCallback(async (query: string): Promise<boolean> => {
    if (!query.trim()) {
      setImages([]);
      return false;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/unsplash/search?query=${encodeURIComponent(query)}&count=12`);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.photos && data.photos.length > 0) {
          const urls = data.photos.map((photo: any) => photo.url);
          setImages(urls);
          setLastSearchedQuery(query);
          setHasSearched(true);
          
          if (!selectedImage && urls[0]) {
            setSelectedImage(urls[0]);
            onSelectImage(urls[0]);
          }
          
          console.log(`${urls.length} afbeeldingen gevonden voor "${query}"`);
          return true;
        } else {
          setImages([]);
          setHasSearched(true);
          console.log(`Geen afbeeldingen gevonden voor "${query}"`);
          return false;
        }
      } else {
        console.error('Unsplash API error:', response.status);
        setImages([]);
        setHasSearched(true);
        return false;
      }
    } catch (error) {
      console.error('Fout bij ophalen afbeeldingen:', error);
      setImages([]);
      setHasSearched(true);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [selectedImage, onSelectImage]);

  useEffect(() => {
    if (searchQuery && searchQuery !== lastSearchedQuery && initialSearchDone.current) {
      const timeoutId = setTimeout(async () => {
        await fetchUnsplashImages(searchQuery);
      }, 600);
      return () => clearTimeout(timeoutId);
    }
  }, [searchQuery, lastSearchedQuery, fetchUnsplashImages]);

  const handleRefreshClick = async () => {
    if (!title) return;
    
    const newTerm = await generateSearchTerm(title, usedSearchTerms);
    
    if (newTerm && newTerm !== currentSearchTerm) {
      setSearchQuery(newTerm);
      setCurrentSearchTerm(newTerm);
      setUsedSearchTerms(prev => [...prev, newTerm]);
      console.log(`Nieuwe AI zoekterm: "${newTerm}" (uitgesloten: ${usedSearchTerms.join(', ')})`);
    } else {
      await fetchUnsplashImages(searchQuery);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      fetchUnsplashImages(searchQuery);
    }
  };

  const handleSelectImage = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    onSelectImage(imageUrl);
  };

  return (
    <div className="space-y-4">
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
          <Search className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-2">
            {isLoading ? 'Afbeeldingen zoeken...' : 'Geen afbeelding geselecteerd'}
          </p>
          <p className="text-xs text-muted-foreground text-center px-4">
            Het zoekveld hieronder is automatisch ingevuld met de titel van je evenement
          </p>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">
            Zoek afbeelding op trefwoord
          </p>
          {isGeneratingTerm && (
            <span className="flex items-center gap-1 text-xs text-primary">
              <Sparkles className="h-3 w-3 animate-pulse" />
              AI genereert zoekterm...
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Typ een zoekterm voor afbeeldingen..."
              value={searchQuery}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              className="pl-10"
              data-testid="input-image-search"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleRefreshClick}
            disabled={isLoading || isGeneratingTerm}
            title="Genereer nieuwe zoekterm"
            data-testid="button-search-images"
          >
            {isLoading || isGeneratingTerm ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">
            AI genereert automatisch een Engelse zoekterm. Klik op refresh voor een andere zoekterm.
          </p>
          {currentSearchTerm && (
            <p className="text-xs text-primary flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              Zoekterm: "{currentSearchTerm}"
            </p>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-24 bg-muted rounded-md">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Afbeeldingen zoeken op Unsplash...</span>
        </div>
      ) : images.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {images.length} afbeeldingen gevonden voor "{lastSearchedQuery}":
          </p>
          <ScrollArea className="w-full">
            <div className="flex space-x-3 pb-4">
              {images.map((imageUrl, index) => (
                <div 
                  key={`image-${index}`}
                  className={`flex-shrink-0 relative rounded-lg overflow-hidden cursor-pointer border-2 transition-all duration-200 hover:scale-105
                    ${selectedImage === imageUrl ? 'border-primary ring-2 ring-primary/20' : 'border-muted-foreground/20 hover:border-primary/50'}`}
                  onClick={() => handleSelectImage(imageUrl)}
                  data-testid={`image-option-${index}`}
                >
                  <img 
                    src={imageUrl} 
                    alt={`Optie ${index + 1}`} 
                    className="w-20 h-20 sm:w-24 sm:h-24 object-cover"
                    loading="lazy"
                    onError={(e) => {
                      console.error(`Afbeelding ${index + 1} laadprobleem:`, imageUrl);
                      const target = e.currentTarget;
                      target.style.display = 'none';
                    }}
                  />
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      ) : hasSearched && searchQuery ? (
        <div className="flex flex-col items-center justify-center h-24 bg-muted rounded-md">
          <p className="text-sm text-muted-foreground">
            Geen afbeeldingen gevonden voor "{lastSearchedQuery}"
          </p>
          <p className="text-xs text-primary mt-1 flex items-center gap-1">
            <RefreshCw className="h-3 w-3" />
            Klik op refresh voor een nieuwe AI zoekterm
          </p>
        </div>
      ) : null}
    </div>
  );
}

export default CategoryImageSelector;
