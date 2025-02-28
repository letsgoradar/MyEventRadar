
import { useState, useEffect, createContext, useContext } from "react";

interface FavoritesContextType {
  favorites: number[];
  toggleFavorite: (eventId: number) => void;
  isFavorite: (eventId: number) => boolean;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export const FavoritesProvider = ({ children }: { children: React.ReactNode }) => {
  const [favorites, setFavorites] = useState<number[]>([]);

  useEffect(() => {
    const savedFavorites = localStorage.getItem('favoriteEvents');
    if (savedFavorites) {
      setFavorites(JSON.parse(savedFavorites));
    }
  }, []);

  const toggleFavorite = (eventId: number) => {
    setFavorites(prev => {
      const newFavorites = prev.includes(eventId) 
        ? prev.filter(id => id !== eventId)
        : [...prev, eventId];
      
      localStorage.setItem('favoriteEvents', JSON.stringify(newFavorites));
      return newFavorites;
    });
  };

  const isFavorite = (eventId: number) => favorites.includes(eventId);

  return (
    <FavoritesContext.Provider value={{ favorites, toggleFavorite, isFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
};

export const useFavorites = () => {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
};
