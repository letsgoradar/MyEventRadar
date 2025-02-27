
import { useState, useEffect } from 'react';

type Location = {
  lat: number;
  lng: number;
};

export function useLocation(defaultRadius = 10) {
  const [location, setLocation] = useState<Location | null>(null);
  const [radius, setRadius] = useState(defaultRadius);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const getLocation = async () => {
      setIsLoading(true);
      try {
        if ('geolocation' in navigator) {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 5000,
              maximumAge: 0
            });
          });
          
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setError(null);
        } else {
          // Default naar Oss als fallback
          setLocation({ lat: 51.7656, lng: 5.5314 });
          setError('Geolocatie wordt niet ondersteund door je browser');
        }
      } catch (err) {
        console.error('Error getting location:', err);
        // Default naar Oss als fallback
        setLocation({ lat: 51.7656, lng: 5.5314 });
        setError('Locatie kon niet worden bepaald, standaardlocatie gebruikt');
      } finally {
        setIsLoading(false);
      }
    };

    getLocation();
  }, []);

  return { location, setLocation, radius, setRadius, isLoading, error };
}
