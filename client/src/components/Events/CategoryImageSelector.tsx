import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Search, Loader2, RefreshCw } from 'lucide-react';

interface CategoryImageSelectorProps {
  category?: string;
  onSelectImage: (imageUrl: string) => void;
  defaultImage?: string;
  title?: string;
  description?: string;
}

function extractSearchWords(text: string): string[] {
  const stopWords = ['de', 'het', 'een', 'voor', 'van', 'met', 'en', 'of', 'op', 'in', 'bij', 'naar', 'aan', 'om', 'te', 'is', 'zijn', 'was', 'worden', 'wordt'];
  
  return text
    .toLowerCase()
    .split(/[\s\-_,.\(\)\[\]]+/)
    .filter(word => word.length > 2)
    .filter(word => !stopWords.includes(word))
    .filter(word => !/^\d+$/.test(word));
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
  
  const [titleWords, setTitleWords] = useState<string[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState<number>(-1);
  const initialSearchDone = useRef(false);

  useEffect(() => {
    if (title) {
      const words = extractSearchWords(title);
      setTitleWords(words);
      console.log(`Titel woorden geëxtraheerd: ${words.join(', ')}`);
    }
  }, [title]);

  const fetchUnsplashImages = useCallback(async (query: string, autoTryNextWord: boolean = false): Promise<boolean> => {
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

  const tryNextWord = useCallback(async () => {
    const nextIndex = currentWordIndex + 1;
    
    if (nextIndex < titleWords.length) {
      const nextWord = titleWords[nextIndex];
      setCurrentWordIndex(nextIndex);
      setSearchQuery(nextWord);
      console.log(`Probeer woord ${nextIndex + 1}/${titleWords.length}: "${nextWord}"`);
      
      const found = await fetchUnsplashImages(nextWord, true);
      
      if (!found && nextIndex + 1 < titleWords.length) {
        console.log(`Geen resultaten voor "${nextWord}", probeer automatisch volgend woord...`);
      }
      
      return found;
    } else {
      console.log('Alle woorden geprobeerd, geen resultaten meer');
      return false;
    }
  }, [currentWordIndex, titleWords, fetchUnsplashImages]);

  useEffect(() => {
    if (title && !initialSearchDone.current) {
      setSearchQuery(title);
      initialSearchDone.current = true;
    }
  }, [title]);

  useEffect(() => {
    if (searchQuery && searchQuery !== lastSearchedQuery && initialSearchDone.current) {
      const timeoutId = setTimeout(async () => {
        const found = await fetchUnsplashImages(searchQuery);
        
        if (!found && currentWordIndex === -1 && titleWords.length > 0) {
          console.log('Volledige titel gaf geen resultaten, probeer eerste woord...');
          tryNextWord();
        }
      }, 600);
      return () => clearTimeout(timeoutId);
    }
  }, [searchQuery, lastSearchedQuery, fetchUnsplashImages, currentWordIndex, titleWords, tryNextWord]);

  const handleRefreshClick = async () => {
    if (titleWords.length > 0 && currentWordIndex < titleWords.length - 1) {
      await tryNextWord();
    } else if (searchQuery.trim()) {
      setCurrentWordIndex(-1);
      await fetchUnsplashImages(searchQuery);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentWordIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setCurrentWordIndex(-1);
      fetchUnsplashImages(searchQuery);
    }
  };

  const handleSelectImage = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    onSelectImage(imageUrl);
  };

  const getRefreshHint = () => {
    if (currentWordIndex >= 0 && currentWordIndex < titleWords.length - 1) {
      return `Klik voor volgend woord: "${titleWords[currentWordIndex + 1]}"`;
    }
    return null;
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
        <p className="text-sm font-medium">
          Zoek afbeelding op trefwoord
        </p>
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
            disabled={isLoading}
            title={getRefreshHint() || "Zoek opnieuw"}
            data-testid="button-search-images"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">
            De zoekterm is automatisch ingevuld met de titel. Pas aan voor betere resultaten.
          </p>
          {getRefreshHint() && (
            <p className="text-xs text-primary">
              {getRefreshHint()}
            </p>
          )}
          {currentWordIndex >= 0 && (
            <p className="text-xs text-muted-foreground">
              Zoekwoord {currentWordIndex + 1} van {titleWords.length}: "{titleWords[currentWordIndex]}"
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
          {currentWordIndex < titleWords.length - 1 && titleWords.length > 0 ? (
            <p className="text-xs text-primary mt-1">
              Klik op de refresh knop om "{titleWords[currentWordIndex + 1]}" te proberen
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">
              Probeer een andere zoekterm
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default CategoryImageSelector;
