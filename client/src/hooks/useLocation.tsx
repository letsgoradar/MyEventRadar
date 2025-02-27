
import { useState, useEffect } from 'react';

export function useLocation() {
  const [userLocation, setUserLocation] = useState<[number, number]>([51.7656, 5.5314]); // Default locatie

  useEffect(() => {
    // Probeer gebruiker locatie op te halen als de browser dit ondersteunt
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([
            position.coords.latitude,
            position.coords.longitude
          ]);
        },
        (error) => {
          console.error("Locatie kon niet worden opgehaald:", error);
          // Blijf de standaard locatie gebruiken
        }
      );
    }
  }, []);

  return { userLocation };
}

