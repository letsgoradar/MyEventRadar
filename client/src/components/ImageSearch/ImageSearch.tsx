
import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Search } from "lucide-react";

// Pexels API key - this would ideally be in an environment variable
const PEXELS_API_KEY = "563492ad6f91700001000001b543baaf65844cecb7a41f8bfeaa97da"; // Free demo key for testing

interface ImageSearchProps {
  onSelectImage: (imageUrl: string, keywords: string[], suggestedCategory: string) => void;
}

export default function ImageSearch({ onSelectImage }: ImageSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [images, setImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const searchImages = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(searchQuery)}&per_page=15`, {
        headers: {
          'Authorization': PEXELS_API_KEY
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch images');
      }
      
      const data = await response.json();
      setImages(data.photos || []);
    } catch (err) {
      setError('Error fetching images. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectImage = async (image: any) => {
    // Extract keywords from the image's alt text and photographer tags
    const keywords = image.alt.split(' ')
      .filter((word: string) => word.length > 3)
      .slice(0, 5);
    
    // Use the image's primary category or the search query as the suggested category
    const suggestedCategory = determineCategory(keywords, searchQuery);
    
    onSelectImage(image.src.large, keywords, suggestedCategory);
  };

  // Simple function to determine category based on keywords
  const determineCategory = (keywords: string[], query: string): string => {
    const categoryMap: Record<string, string[]> = {
      'festival': ['festival', 'music', 'concert', 'party', 'celebration'],
      'sports': ['sport', 'run', 'ball', 'match', 'game', 'fitness', 'exercise'],
      'food': ['food', 'dinner', 'lunch', 'restaurant', 'meal', 'cooking'],
      'culture': ['museum', 'art', 'exhibition', 'culture', 'history', 'theater'],
      'market': ['market', 'shop', 'store', 'shopping', 'fair'],
      'education': ['education', 'workshop', 'class', 'learn', 'study', 'training'],
      'music': ['music', 'concert', 'band', 'song', 'performance'],
      'technology': ['tech', 'computer', 'digital', 'code', 'programming'],
      'gaming': ['game', 'gaming', 'play', 'console', 'esport'],
      'health': ['health', 'wellness', 'medical', 'therapy', 'yoga'],
      'nature': ['nature', 'outdoor', 'park', 'hike', 'mountain', 'garden']
    };
    
    // Check keywords against category keywords
    for (const [category, categoryKeywords] of Object.entries(categoryMap)) {
      if (keywords.some(keyword => 
          categoryKeywords.some(ck => 
            keyword.toLowerCase().includes(ck) || ck.includes(keyword.toLowerCase())
          )
        )) {
        return category;
      }
    }
    
    // Check search query against category keywords
    for (const [category, categoryKeywords] of Object.entries(categoryMap)) {
      if (categoryKeywords.some(ck => 
          query.toLowerCase().includes(ck) || ck.includes(query.toLowerCase())
        )) {
        return category;
      }
    }
    
    // Default to 'festival' if no match
    return 'festival';
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      searchImages();
    }
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col space-y-2">
        <label className="text-sm font-medium">Zoek een afbeelding voor je evenement</label>
        <div className="flex space-x-2">
          <Input
            placeholder="Bijv. concert, markt, yoga..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1"
          />
          <Button onClick={searchImages} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-80 overflow-auto p-1">
        {images.map((image) => (
          <Card 
            key={image.id} 
            className="overflow-hidden cursor-pointer hover:scale-105 transition-transform"
            onClick={() => handleSelectImage(image)}
          >
            <img 
              src={image.src.medium} 
              alt={image.alt} 
              className="w-full h-36 object-cover"
            />
            <div className="p-2 text-xs truncate">{image.alt}</div>
          </Card>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center p-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && images.length === 0 && searchQuery && (
        <p className="text-center text-muted-foreground">
          Geen afbeeldingen gevonden, probeer andere zoektermen.
        </p>
      )}
    </div>
  );
}
