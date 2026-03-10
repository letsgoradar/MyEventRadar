
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

const DEFAULT_COORDINATES: Coordinates = { lat: 51.7656, lng: 5.5314 };

let cachedLocation: Coordinates | null = null;
let cachedError: GeolocationPositionError | null = null;
let locationResolved = false;
let locationListeners: Array<() => void> = [];
let locationRequested = false;

function requestLocation() {
  if (locationRequested) return;
  locationRequested = true;

  if (!navigator.geolocation) {
    cachedLocation = DEFAULT_COORDINATES;
    locationResolved = true;
    notifyListeners();
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      cachedLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      cachedError = null;
      locationResolved = true;
      notifyListeners();
    },
    (error) => {
      cachedError = error;
      cachedLocation = DEFAULT_COORDINATES;
      locationResolved = true;
      notifyListeners();
    },
    {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 300000,
    }
  );
}

function notifyListeners() {
  locationListeners.forEach((fn) => fn());
  locationListeners = [];
}

export function useLocation(): LocationHook {
  const [location, setLocation] = useState<Coordinates | null>(cachedLocation);
  const [locationError, setLocationError] = useState<GeolocationPositionError | null>(cachedError);
  const [isLoadingLocation, setIsLoadingLocation] = useState(!locationResolved);

  useEffect(() => {
    if (locationResolved) {
      setLocation(cachedLocation);
      setLocationError(cachedError);
      setIsLoadingLocation(false);
      return;
    }

    const listener = () => {
      setLocation(cachedLocation);
      setLocationError(cachedError);
      setIsLoadingLocation(false);
    };

    locationListeners.push(listener);
    requestLocation();

    return () => {
      const idx = locationListeners.indexOf(listener);
      if (idx >= 0) locationListeners.splice(idx, 1);
    };
  }, []);

  return { location, locationError, isLoadingLocation };
}
