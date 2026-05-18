import { useState, useEffect } from "react";

export interface Coordinates {
  lat: number;
  lng: number;
}

const STORAGE_KEY = "app_user_location_session";

let cachedLocation: Coordinates | null = null;
let activeSetters: Array<(loc: Coordinates | null) => void> = [];

export function setManualLocation(coords: Coordinates): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(coords));
  } catch {}
  cachedLocation = coords;
  activeSetters.forEach((setter) => setter(coords));
}

export function clearSavedLocation(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("app_user_location");
  } catch {}
  cachedLocation = null;
  activeSetters.forEach((setter) => setter(null));
}

export function useLocation() {
  const [location, setLocation] = useState<Coordinates | null>(cachedLocation);

  useEffect(() => {
    setLocation(cachedLocation);
    activeSetters.push(setLocation);
    return () => {
      const i = activeSetters.indexOf(setLocation);
      if (i >= 0) activeSetters.splice(i, 1);
    };
  }, []);

  return { location };
}
