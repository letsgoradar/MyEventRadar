import { useState, useEffect } from "react";

export interface Coordinates {
  lat: number;
  lng: number;
}

const STORAGE_KEY = "app_user_location_session";
const CITY_CACHE_PREFIX = "app_city_name_";

let cachedLocation: Coordinates | null = null;
let activeSetters: Array<(loc: Coordinates | null) => void> = [];
let activeCitySetters: Array<(name: string | null) => void> = [];
let cachedCityName: string | null = null;

export function setManualLocation(coords: Coordinates): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(coords));
  } catch {}
  cachedLocation = coords;
  cachedCityName = null;
  activeSetters.forEach((setter) => setter(coords));
  activeCitySetters.forEach((setter) => setter(null));
}

export function clearSavedLocation(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("app_user_location");
  } catch {}
  cachedLocation = null;
  cachedCityName = null;
  activeSetters.forEach((setter) => setter(null));
  activeCitySetters.forEach((setter) => setter(null));
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

function getCitySessionKey(lat: number, lng: number): string {
  return `${CITY_CACHE_PREFIX}${lat.toFixed(3)}_${lng.toFixed(3)}`;
}

export function useCityName(): string | null {
  const { location } = useLocation();
  const [cityName, setCityName] = useState<string | null>(cachedCityName);

  useEffect(() => {
    activeCitySetters.push(setCityName);
    return () => {
      const i = activeCitySetters.indexOf(setCityName);
      if (i >= 0) activeCitySetters.splice(i, 1);
    };
  }, []);

  useEffect(() => {
    if (!location) {
      setCityName(null);
      cachedCityName = null;
      return;
    }

    const sessionKey = getCitySessionKey(location.lat, location.lng);

    try {
      const cached = sessionStorage.getItem(sessionKey);
      if (cached) {
        setCityName(cached);
        cachedCityName = cached;
        return;
      }
    } catch {}

    const fetchCity = async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${location.lat}&lon=${location.lng}&format=json`,
          { headers: { "Accept-Language": "nl" } }
        );
        if (!res.ok) throw new Error("Nominatim error");
        const data = await res.json();
        const addr = data.address || {};
        const name =
          addr.city ||
          addr.town ||
          addr.village ||
          addr.municipality ||
          addr.county ||
          `${location.lat.toFixed(2)}, ${location.lng.toFixed(2)}`;
        try {
          sessionStorage.setItem(sessionKey, name);
        } catch {}
        setCityName(name);
        cachedCityName = name;
        activeCitySetters.forEach((s) => s !== setCityName && s(name));
      } catch {
        const fallback = `${location.lat.toFixed(2)}, ${location.lng.toFixed(2)}`;
        try {
          sessionStorage.setItem(sessionKey, fallback);
        } catch {}
        setCityName(fallback);
        cachedCityName = fallback;
        activeCitySetters.forEach((s) => s !== setCityName && s(fallback));
      }
    };

    fetchCity();
  }, [location?.lat, location?.lng]);

  return cityName;
}
