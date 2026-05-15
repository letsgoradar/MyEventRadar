import { useState, useEffect } from "react";

export interface Coordinates {
  lat: number;
  lng: number;
}

const STORAGE_KEY = "app_user_location";

function loadSavedLocation(): Coordinates | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (typeof parsed.lat === "number" && typeof parsed.lng === "number") {
        return { lat: parsed.lat, lng: parsed.lng };
      }
    }
  } catch {}
  return null;
}

let cachedLocation: Coordinates | null = loadSavedLocation();
let activeSetters: Array<(loc: Coordinates | null) => void> = [];

export function setManualLocation(coords: Coordinates): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(coords));
  } catch {}
  cachedLocation = coords;
  activeSetters.forEach((setter) => setter(coords));
}

export function clearSavedLocation(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
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
