import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ExternalLink } from "lucide-react";

interface ServedAd {
  id: number;
  campaignId?: number;
  title: string;
  description: string | null;
  imageUrl: string | null;
  ctaUrl: string;
  ctaText: string;
  companyName: string;
  logoUrl: string | null;
  cpmCents: number;
}

interface AdBannerProps {
  type?: "house" | "served";
  onClick?: () => void;
  lat?: number;
  lng?: number;
  eventCategory?: string;
  eventId?: number;
  onCampaignId?: (campaignId: number) => void;
  placement?: "banner" | "external_interstitial";
}

export function AdBanner({ type = "house", onClick, lat, lng, eventCategory, eventId, onCampaignId, placement = "banner" }: AdBannerProps) {
  const [radarAngle, setRadarAngle] = useState(0);
  const [pulseScale, setPulseScale] = useState(1);
  const [dotPositions, setDotPositions] = useState<{x: number, y: number, opacity: number}[]>([]);
  const [impressionTracked, setImpressionTracked] = useState(false);
  const impressionKey = useRef(`impression-${Date.now()}-${Math.random().toString(36).slice(2)}`).current;
  const clickKey = useRef(`click-${Date.now()}-${Math.random().toString(36).slice(2)}`).current;

  const queryParams = lat && lng
    ? `/api/ads/serve?lat=${lat}&lng=${lng}&placement=${placement}${eventCategory ? `&eventCategory=${encodeURIComponent(eventCategory)}` : ''}`
    : null;

  const { data: servedAd } = useQuery<ServedAd | null>({
    queryKey: ['/api/ads/serve', lat, lng, eventCategory, placement],
    enabled: type === "served" && !!queryParams,
    staleTime: 60000,
    queryFn: async () => {
      if (!queryParams) return null;
      const res = await fetch(queryParams, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  useEffect(() => {
    if (servedAd && !impressionTracked) {
      setImpressionTracked(true);
      if (servedAd.campaignId) onCampaignId?.(servedAd.campaignId);
      apiRequest('/api/ads/impression', {
        method: 'POST',
        data: { adId: servedAd.id, campaignId: servedAd.campaignId, eventId, idempotencyKey: impressionKey },
      }).catch(() => {});
    }
  }, [servedAd, impressionTracked, eventId, impressionKey, onCampaignId]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRadarAngle(prev => (prev + 3) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const pulseInterval = setInterval(() => {
      setPulseScale(prev => prev === 1 ? 1.05 : 1);
    }, 1500);
    return () => clearInterval(pulseInterval);
  }, []);

  useEffect(() => {
    const dots = Array.from({ length: 5 }, () => ({
      x: 20 + Math.random() * 60,
      y: 20 + Math.random() * 60,
      opacity: 0.3 + Math.random() * 0.7,
    }));
    setDotPositions(dots);
  }, []);

  const handleAdClick = useCallback(() => {
    if (servedAd) {
      apiRequest('/api/ads/click', {
        method: 'POST',
        data: { adId: servedAd.id, campaignId: servedAd.campaignId, eventId, idempotencyKey: clickKey },
      }).catch(() => {});
      window.open(servedAd.ctaUrl, '_blank', 'noopener,noreferrer');
    }
  }, [servedAd, eventId, clickKey]);

  if (type === "served" && servedAd) {
    return (
      <div
        className="relative w-full h-full bg-white rounded-2xl overflow-hidden cursor-pointer group shadow-xl border border-gray-100 hover:shadow-2xl transition-shadow"
        onClick={handleAdClick}
      >
        <span className="absolute top-2 left-2 z-20 bg-gray-100 text-gray-500 text-[10px] font-medium px-2 py-0.5 rounded-full">
          Advertentie
        </span>

        {servedAd.imageUrl ? (
          <div className="absolute inset-0">
            <img
              src={servedAd.imageUrl}
              alt={servedAd.title}
              className="w-full h-full object-cover opacity-20"
            />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-teal-50 to-cyan-50" />
        )}

        <div className="relative z-10 p-4 h-full flex items-center gap-3">
          {servedAd.logoUrl && (
            <div className="flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden bg-white shadow-sm border border-gray-100">
              <img
                src={servedAd.logoUrl}
                alt={servedAd.companyName}
                className="w-full h-full object-contain p-1"
              />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <p className="text-gray-400 text-[10px] font-medium uppercase tracking-wide">
              {servedAd.companyName}
            </p>
            <h3 className="text-gray-800 text-sm font-bold leading-tight truncate">
              {servedAd.title}
            </h3>
            {servedAd.description && (
              <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">
                {servedAd.description}
              </p>
            )}
          </div>

          <div className="flex-shrink-0">
            <div className="inline-flex items-center gap-1 bg-teal-500 text-white px-3 py-1.5 rounded-full font-semibold text-xs group-hover:bg-teal-600 transition-colors">
              <span>{servedAd.ctaText}</span>
              <ExternalLink className="w-3 h-3" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="relative w-full h-full bg-gradient-to-br from-teal-600 via-teal-500 to-cyan-500 rounded-2xl overflow-hidden cursor-pointer group shadow-xl"
      onClick={onClick}
      style={{ transform: `scale(${pulseScale})`, transition: "transform 0.5s ease-in-out" }}
    >
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 50% 50%, transparent 0%, transparent 20%, rgba(255,255,255,0.1) 21%, transparent 22%, transparent 40%, rgba(255,255,255,0.1) 41%, transparent 42%, transparent 60%, rgba(255,255,255,0.1) 61%, transparent 62%)`,
          backgroundSize: "200px 200px",
          backgroundPosition: "center",
        }} />
      </div>
      
      <svg 
        className="absolute right-4 top-1/2 -translate-y-1/2 w-32 h-32 opacity-30"
        viewBox="0 0 100 100"
      >
        <circle cx="50" cy="50" r="45" stroke="white" strokeWidth="1" fill="none" />
        <circle cx="50" cy="50" r="32" stroke="white" strokeWidth="1" fill="none" />
        <circle cx="50" cy="50" r="19" stroke="white" strokeWidth="1" fill="none" />
        <circle cx="50" cy="50" r="4" fill="white" />
        
        <g style={{ transform: `rotate(${radarAngle}deg)`, transformOrigin: "50px 50px" }}>
          <path d="M50 50 L50 8 A42 42 0 0 1 85 32 Z" fill="white" opacity="0.5"/>
          <line x1="50" y1="50" x2="78" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </g>
        
        {dotPositions.map((dot, i) => (
          <circle 
            key={i} 
            cx={dot.x} 
            cy={dot.y} 
            r="3" 
            fill="white" 
            opacity={dot.opacity}
            className="animate-pulse"
          />
        ))}
      </svg>

      <div className="relative z-10 p-4 h-full flex flex-col justify-center">
        <h3 className="text-white text-xl font-bold mb-1 leading-tight">
          Bereik lokale<br />bezoekers
        </h3>
        
        <p className="text-white/90 text-xs mb-3 max-w-[180px]">
          Promoot jouw bedrijf bij duizenden evenementbezoekers in de regio
        </p>
        
        <div className="inline-flex items-center gap-1.5 bg-white text-teal-600 px-3 py-1.5 rounded-full font-semibold text-xs group-hover:bg-teal-50 transition-colors w-fit">
          <span>Adverteer hier</span>
          <svg className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
        <div className="h-full bg-white/40 animate-pulse" style={{ width: "100%" }} />
      </div>
    </div>
  );
}
