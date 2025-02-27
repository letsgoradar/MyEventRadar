
import { useState, useEffect } from "react";

interface Coordinates {
  lat: number;
  lng: number;
}

interface LocationHook {
  location: Coordinates | null;
  locationError: GeolocationPositionError | null;
  isLoadingLocation: boolean;
}

export function useLocation(): LocationHook {
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [locationError, setLocationError] = useState<GeolocationPositionError | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  
  // Default to Oss coordinates
  const DEFAULT_COORDINATES: Coordinates = { lat: 51.7656, lng: 5.5314 };

  useEffect(() => {
    // Check if geolocation is supported
    if (!navigator.geolocation) {
      console.log("Geolocation is not supported by your browser");
      setLocation(DEFAULT_COORDINATES);
      setIsLoadingLocation(false);
      return;
    }

    // Get user's location
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log("Got user location:", position.coords.latitude, position.coords.longitude);
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setIsLoadingLocation(false);
        setLocationError(null);
      },
      (error) => {
        console.error("Error getting location:", error);
        setLocationError(error);
        // Fall back to default location
        setLocation(DEFAULT_COORDINATES);
        setIsLoadingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );
  }, []);

  return { location, locationError, isLoadingLocation };
}
