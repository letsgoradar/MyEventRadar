
import { useState, useEffect } from "react";

interface LocationState {
  lat: number;
  lng: number;
}

export function useLocation() {
  const [location, setLocation] = useState<LocationState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const getLocation = () => {
      if (isMounted) setLoading(true);
      
      if (!navigator.geolocation) {
        if (isMounted) {
          setError("Geolocation wordt niet ondersteund door deze browser.");
          setLoading(false);
        }
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (isMounted) {
            console.log("Locatie succesvol opgevraagd:", position.coords);
            setLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
            setLoading(false);
            setError(null);
          }
        },
        (error) => {
          if (isMounted) {
            console.error("Fout bij opvragen locatie:", error);
            setError("Kon uw locatie niet ophalen. Standaardlocatie wordt gebruikt.");
            // Gebruik een standaardlocatie (bijv. centrum van Nederland)
            setLocation({
              lat: 52.1326,
              lng: 5.2913,
            });
            setLoading(false);
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000, // 1 minuut caching
        }
      );
    };

    getLocation();

    return () => {
      isMounted = false;
    };
  }, []);

  return { location, loading, error };
}
