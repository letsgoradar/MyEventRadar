import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Home, Search, RefreshCw, Lock, AlertTriangle, ServerCrash, Compass, Coffee } from "lucide-react";
import { Link } from "wouter";

interface ErrorConfig {
  code: number;
  title: string;
  message: string;
  subMessage: string;
  icon: "radar" | "confused" | "broken" | "loading" | "locked";
  showSearch?: boolean;
  showRefresh?: boolean;
}

const errorConfigs: Record<number, ErrorConfig> = {
  404: {
    code: 404,
    title: "Oeps, verdwaald!",
    message: "Deze pagina is op avontuur gegaan...",
    subMessage: "Misschien is de pagina verhuisd, of heb je een verkeerde URL ingevoerd. Geen zorgen, we helpen je terug!",
    icon: "radar",
    showSearch: true,
  },
  400: {
    code: 400,
    title: "Hmm, dat snapten we niet",
    message: "Er zit iets raars in je verzoek",
    subMessage: "Probeer het opnieuw of ga terug naar de homepagina. Als dit blijft gebeuren, laat het ons weten!",
    icon: "confused",
    showRefresh: true,
  },
  403: {
    code: 403,
    title: "Verboden terrein!",
    message: "Je hebt geen toegang tot deze pagina",
    subMessage: "Deze plek is alleen voor speciale gasten. Log in met een account dat toegang heeft, of ontdek andere evenementen!",
    icon: "locked",
    showSearch: true,
  },
  500: {
    code: 500,
    title: "Ai, er ging iets mis",
    message: "Onze servers hebben even een koffiepauze nodig",
    subMessage: "We zijn hard bezig om dit op te lossen. Probeer het over een paar minuten nog eens!",
    icon: "broken",
    showRefresh: true,
  },
  503: {
    code: 503,
    title: "Even geduld...",
    message: "We zijn druk bezig met onderhoud",
    subMessage: "We maken Evenementenradar.nl nog beter voor je! Over een paar minuten zijn we weer terug.",
    icon: "loading",
    showRefresh: true,
  },
};

function RadarAnimation() {
  return (
    <div className="relative w-32 h-32 mx-auto mb-6">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-24 h-24 rounded-full border-4 border-primary/30" />
        <div className="absolute w-16 h-16 rounded-full border-4 border-primary/50" />
        <div className="absolute w-8 h-8 rounded-full border-4 border-primary/70" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center animate-spin" style={{ animationDuration: '3s' }}>
        <div className="w-1 h-12 bg-gradient-to-t from-primary to-transparent origin-bottom" style={{ transformOrigin: 'bottom center' }} />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <MapPin className="w-6 h-6 text-primary animate-bounce" style={{ animationDuration: '2s' }} />
      </div>
      <div className="absolute top-2 right-4 animate-pulse" style={{ animationDelay: '0.5s' }}>
        <div className="w-2 h-2 rounded-full bg-primary/60" />
      </div>
      <div className="absolute bottom-4 left-2 animate-pulse" style={{ animationDelay: '1s' }}>
        <div className="w-2 h-2 rounded-full bg-primary/40" />
      </div>
    </div>
  );
}

function ConfusedAnimation() {
  return (
    <div className="relative w-32 h-32 mx-auto mb-6 flex items-center justify-center">
      <div className="relative">
        <Compass className="w-20 h-20 text-primary/80" />
        <div className="absolute -top-2 -right-2 animate-spin" style={{ animationDuration: '4s' }}>
          <AlertTriangle className="w-8 h-8 text-amber-500" />
        </div>
      </div>
      <div className="absolute top-0 left-4 text-2xl animate-bounce" style={{ animationDelay: '0.3s', animationDuration: '1.5s' }}>?</div>
      <div className="absolute top-2 right-2 text-xl animate-bounce" style={{ animationDelay: '0.6s', animationDuration: '1.5s' }}>?</div>
      <div className="absolute bottom-4 left-8 text-lg animate-bounce" style={{ animationDelay: '0.9s', animationDuration: '1.5s' }}>?</div>
    </div>
  );
}

function BrokenAnimation() {
  return (
    <div className="relative w-32 h-32 mx-auto mb-6 flex items-center justify-center">
      <div className="relative">
        <ServerCrash className="w-16 h-16 text-primary/70 animate-pulse" />
        <div className="absolute -bottom-2 -right-4">
          <Coffee className="w-10 h-10 text-amber-600 animate-bounce" style={{ animationDuration: '2s' }} />
        </div>
      </div>
      <div className="absolute top-2 right-6 text-xs text-gray-400 animate-pulse">zzZ</div>
      <div className="absolute top-0 right-2 text-sm text-gray-400 animate-pulse" style={{ animationDelay: '0.3s' }}>zZ</div>
    </div>
  );
}

function LoadingAnimation() {
  return (
    <div className="relative w-32 h-32 mx-auto mb-6 flex items-center justify-center">
      <div className="flex space-x-2">
        <div className="w-4 h-4 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0s' }} />
        <div className="w-4 h-4 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.2s' }} />
        <div className="w-4 h-4 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.4s' }} />
      </div>
      <div className="absolute -bottom-4 flex items-center gap-1 text-primary/60">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span className="text-xs">bezig...</span>
      </div>
    </div>
  );
}

function LockedAnimation() {
  return (
    <div className="relative w-32 h-32 mx-auto mb-6 flex items-center justify-center">
      <div className="relative">
        <div className="w-20 h-16 bg-gradient-to-b from-primary/30 to-primary/50 rounded-lg flex items-center justify-center">
          <Lock className="w-10 h-10 text-primary animate-pulse" style={{ animationDuration: '2s' }} />
        </div>
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-8 border-4 border-primary/60 rounded-t-full" />
      </div>
      <div className="absolute top-0 left-2 text-xl animate-bounce" style={{ animationDelay: '0.2s', animationDuration: '2s' }}>🚫</div>
      <div className="absolute bottom-2 right-2 text-xl animate-bounce" style={{ animationDelay: '0.5s', animationDuration: '2s' }}>🔐</div>
    </div>
  );
}

function AnimationComponent({ type }: { type: ErrorConfig["icon"] }) {
  switch (type) {
    case "radar": return <RadarAnimation />;
    case "confused": return <ConfusedAnimation />;
    case "broken": return <BrokenAnimation />;
    case "loading": return <LoadingAnimation />;
    case "locked": return <LockedAnimation />;
    default: return <RadarAnimation />;
  }
}

interface ErrorPageProps {
  code?: number;
  title?: string;
  message?: string;
}

export default function ErrorPage({ code = 404, title, message }: ErrorPageProps) {
  const config = errorConfigs[code] || errorConfigs[404];
  
  const displayTitle = title || config.title;
  const displayMessage = message || config.message;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-primary/5 p-4">
      <Card className="w-full max-w-lg mx-4 shadow-xl border-0 overflow-hidden">
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent py-8">
          <AnimationComponent type={config.icon} />
        </div>
        
        <CardContent className="pt-6 pb-8 text-center">
          <div className="inline-flex items-center justify-center px-4 py-1 mb-4 rounded-full bg-primary/10 text-primary font-mono text-sm font-bold">
            Error {config.code}
          </div>
          
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            {displayTitle}
          </h1>
          
          <p className="text-lg text-gray-600 mb-2">
            {displayMessage}
          </p>
          
          <p className="text-sm text-gray-500 mb-8 max-w-sm mx-auto">
            {config.subMessage}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/">
              <Button variant="default" className="gap-2 w-full sm:w-auto">
                <Home className="w-4 h-4" />
                Naar Home
              </Button>
            </Link>
            
            {config.showSearch && (
              <Link href="/web">
                <Button variant="outline" className="gap-2 w-full sm:w-auto">
                  <Search className="w-4 h-4" />
                  Zoek Evenementen
                </Button>
              </Link>
            )}
            
            {config.showRefresh && (
              <Button 
                variant="outline" 
                className="gap-2 w-full sm:w-auto"
                onClick={() => window.location.reload()}
              >
                <RefreshCw className="w-4 h-4" />
                Probeer Opnieuw
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      
      <style>{`
        @keyframes radar-sweep {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
