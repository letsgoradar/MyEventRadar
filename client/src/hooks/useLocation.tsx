
import { useState, useEffect } from "react";

// Default location (centrum van Nederland)
const DEFAULT_LOCATION: [number, number] = [52.0907, 5.1214];

export const useLocation = () => {
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedLocation = localStorage.getItem('userLocation');

    // Probeer een opgeslagen locatie te gebruiken
    if (storedLocation) {
      try {
        const [lat, lng] = JSON.parse(storedLocation);
        if (typeof lat === 'number' && typeof lng === 'number') {
          setUserLocation([lat, lng]);
          setIsLoading(false);
          return;
        }
      } catch (e) {
        // Continue to get new location if parse fails
        console.warn("Failed to parse stored location");
      }
    }

    // Anders probeer geolocation te gebruiken
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation: [number, number] = [
            position.coords.latitude,
            position.coords.longitude
          ];
          setUserLocation(newLocation);
          localStorage.setItem('userLocation', JSON.stringify(newLocation));
          setIsLoading(false);
        },
        (error) => {
          console.error("Error getting location:", error.message);
          setError(`Locatie niet beschikbaar: ${error.message}`);
          setUserLocation(DEFAULT_LOCATION);
          setIsLoading(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      );
    } else {
      setError("Geolocation wordt niet ondersteund in deze browser");
      setUserLocation(DEFAULT_LOCATION);
      setIsLoading(false);
    }
  }, []);

  const updateLocation = (newLocation: [number, number]) => {
    setUserLocation(newLocation);
    localStorage.setItem('userLocation', JSON.stringify(newLocation));
  };

  return {
    userLocation: userLocation || DEFAULT_LOCATION,
    isLoading,
    error,
    updateLocation
  };
};
