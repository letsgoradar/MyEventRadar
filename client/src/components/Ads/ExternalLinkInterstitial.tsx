import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, Clock } from "lucide-react";
import { AdBanner } from "./AdBanner";
import { RadarLogoWithText } from "@/components/RadarLogo";

interface ExternalLinkInterstitialProps {
  externalUrl: string;
  eventTitle?: string;
  onClose: () => void;
  onAdClick?: () => void;
  isPremium?: boolean;
  eventLat?: number;
  eventLng?: number;
  eventCategory?: string;
  eventId?: number;
}

export function ExternalLinkInterstitial({ 
  externalUrl, 
  eventTitle,
  onClose,
  onAdClick,
  isPremium = false,
  eventLat,
  eventLng,
  eventCategory,
  eventId,
}: ExternalLinkInterstitialProps) {
  const [countdown, setCountdown] = useState(isPremium ? 0 : 5);
  const [canProceed, setCanProceed] = useState(isPremium);

  const hasLocation = eventLat !== undefined && eventLng !== undefined;

  useEffect(() => {
    if (isPremium) {
      window.open(externalUrl, '_blank', 'noopener,noreferrer');
      onClose();
      return;
    }
    
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setCanProceed(true);
    }
  }, [countdown, isPremium, externalUrl, onClose]);

  const handleProceed = useCallback(() => {
    window.open(externalUrl, '_blank', 'noopener,noreferrer');
    onClose();
  }, [externalUrl, onClose]);

  const handleAdClick = () => {
    if (onAdClick) {
      onAdClick();
    } else {
      window.location.href = "mailto:adverteren@letsgoradar.nl?subject=Adverteren%20op%20letsgo%20radar";
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-gradient-to-b from-teal-50 to-white flex flex-col">
      <div className="flex items-center justify-between p-4 border-b bg-white/80 backdrop-blur-sm">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={onClose}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Terug naar letsgo radar</span>
        </Button>
        
        <RadarLogoWithText height={24} textColor="#0D9488" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
        <div className="text-center mb-2">
          <p className="text-gray-500 text-sm mb-1">Je gaat naar</p>
          <p className="text-gray-800 font-medium text-lg max-w-md truncate">
            {eventTitle || new URL(externalUrl).hostname}
          </p>
        </div>

        <div className="w-full max-w-md aspect-[2/1] min-h-[180px]">
          <AdBanner
            type={hasLocation ? "served" : "house"}
            onClick={handleAdClick}
            lat={eventLat}
            lng={eventLng}
            eventCategory={eventCategory}
            eventId={eventId}
          />
        </div>

        <div className="flex flex-col items-center gap-4 mt-4">
          {!canProceed ? (
            <div className="flex items-center gap-3 text-gray-500">
              <Clock className="w-5 h-5 animate-pulse" />
              <span className="text-lg">
                Doorverwijzing over <span className="font-bold text-teal-600">{countdown}</span> seconden
              </span>
            </div>
          ) : (
            <Button 
              size="lg"
              onClick={handleProceed}
              className="flex items-center gap-2 bg-teal-500 hover:bg-teal-600 text-white px-8 py-6 text-lg rounded-full shadow-lg"
            >
              <span>Ga naar website</span>
              <ExternalLink className="w-5 h-5" />
            </Button>
          )}

          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-sm underline"
          >
            Annuleren en terug
          </button>
        </div>
      </div>

      <div className="p-4 border-t bg-white/80 backdrop-blur-sm">
        <p className="text-center text-xs text-gray-400">
          Je verlaat nu de letsgo radar app. De externe website is niet onderdeel van onze dienst.
        </p>
      </div>
    </div>
  );
}
