import * as React from "react";
import { MapPin, Search, Navigation, Loader2, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setManualLocation } from "@/hooks/useLocation";
import { RadarLogoWithText } from "@/components/RadarLogo";

interface GeoResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
  };
}

interface LocationSetupScreenProps {
  onDismiss?: () => void;
}

export function LocationSetupScreen({ onDismiss }: LocationSetupScreenProps = {}) {
  const [step, setStep] = React.useState<"checking" | "initial" | "gps-loading" | "manual">("checking");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [results, setResults] = React.useState<GeoResult[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [gpsError, setGpsError] = React.useState<string | null>(null);
  const searchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const gpsStartedRef = React.useRef(false);

  React.useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const doGPS = React.useCallback(() => {
    if (gpsStartedRef.current) return;
    gpsStartedRef.current = true;
    setStep("gps-loading");
    setGpsError(null);

    if (!navigator.geolocation) {
      setGpsError("Locatiediensten zijn niet beschikbaar op dit apparaat.");
      setStep("manual");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setManualLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        let msg = "Locatietoegang geweigerd.";
        if (error.code === error.TIMEOUT) msg = "Locatiebepaling duurde te lang.";
        if (error.code === error.POSITION_UNAVAILABLE) msg = "Locatie kon niet worden bepaald.";
        setGpsError(msg + " Voer je stad of postcode in.");
        setStep("manual");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  React.useEffect(() => {
    if (!navigator.permissions) {
      setStep("initial");
      return;
    }
    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((status) => {
        if (status.state === "granted") {
          doGPS();
        } else {
          // "denied" or "prompt": always show initial screen with both options.
          // If truly denied the user can enable location in browser settings;
          // clicking GPS will show an error + fall back to manual search.
          setStep("initial");
        }
      })
      .catch(() => {
        setStep("initial");
      });
  }, [doGPS]);

  const handleUseGPS = React.useCallback(() => {
    gpsStartedRef.current = false;
    doGPS();
  }, [doGPS]);

  const handleSearch = React.useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=nl,be&limit=6&addressdetails=1`;
      const resp = await fetch(url, {
        headers: { "Accept-Language": "nl" },
      });
      if (resp.ok) {
        const data: GeoResult[] = await resp.json();
        setResults(data);
      }
    } catch {
      // silent fail
    } finally {
      setSearching(false);
    }
  }, []);

  const handleSearchChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchQuery(value);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      searchTimerRef.current = setTimeout(() => handleSearch(value), 350);
    },
    [handleSearch]
  );

  const handleSelectResult = React.useCallback((result: GeoResult) => {
    setManualLocation({
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
    });
  }, []);

  function getPlaceName(result: GeoResult): string {
    const a = result.address;
    return (
      a?.city || a?.town || a?.village || a?.municipality ||
      result.display_name.split(",")[0]
    );
  }

  function getPlaceDetail(result: GeoResult): string {
    const parts = result.display_name.split(",").map((s) => s.trim());
    return parts.slice(1, 3).join(", ");
  }

  if (step === "checking") {
    return (
      <div className="fixed inset-0 z-[500] flex flex-col items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[500] flex flex-col bg-background">
      {onDismiss && (
        <div className="flex justify-end p-4">
          <button
            onClick={onDismiss}
            className="rounded-full p-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Sluiten"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8 pb-8">
        <div className="flex flex-col items-center gap-3">
          <RadarLogoWithText height={48} textColor="hsl(var(--foreground))" />
          <p className="text-muted-foreground text-sm text-center max-w-xs">
            Om evenementen bij jou in de buurt te vinden, hebben we je locatie nodig.
          </p>
        </div>

        {step === "initial" && (
          <div className="flex flex-col gap-4 w-full max-w-sm">
            <Button
              size="lg"
              className="w-full gap-2 h-14 text-base"
              onClick={handleUseGPS}
            >
              <Navigation className="h-5 w-5" />
              Gebruik mijn locatie
            </Button>

            <div className="relative flex items-center">
              <div className="flex-1 border-t" />
              <span className="px-3 text-xs text-muted-foreground">of</span>
              <div className="flex-1 border-t" />
            </div>

            <Button
              size="lg"
              variant="outline"
              className="w-full gap-2 h-14 text-base"
              onClick={() => setStep("manual")}
            >
              <Search className="h-5 w-5" />
              Voer stad of postcode in
            </Button>
          </div>
        )}

        {step === "gps-loading" && (
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
            <p className="text-sm text-muted-foreground">Locatie bepalen...</p>
          </div>
        )}

        {step === "manual" && (
          <div className="flex flex-col gap-4 w-full max-w-sm">
            {gpsError && (
              <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">
                {gpsError}
              </p>
            )}

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                autoFocus
                placeholder="Bijv. Ommen, Amsterdam, 7731..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="pl-9 h-12"
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {results.length > 0 && (
              <div className="flex flex-col divide-y rounded-xl border bg-card overflow-hidden shadow-sm">
                {results.map((result) => (
                  <button
                    key={result.place_id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                    onClick={() => handleSelectResult(result)}
                  >
                    <MapPin className="h-4 w-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {getPlaceName(result)}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {getPlaceDetail(result)}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {!gpsError && (
              <button
                className="text-sm text-muted-foreground underline-offset-2 hover:underline text-center"
                onClick={handleUseGPS}
              >
                Toch GPS gebruiken
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
