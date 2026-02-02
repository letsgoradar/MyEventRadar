import { useState, useEffect } from "react";

interface AdBannerProps {
  type?: "house" | "external";
  onClick?: () => void;
}

export function AdBanner({ type = "house", onClick }: AdBannerProps) {
  const [radarAngle, setRadarAngle] = useState(0);
  const [pulseScale, setPulseScale] = useState(1);
  const [dotPositions, setDotPositions] = useState<{x: number, y: number, opacity: number}[]>([]);

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

  if (type === "house") {
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

        <div className="relative z-10 p-6 h-full flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="text-white/80 text-xs font-medium uppercase tracking-wider">Advertentie</span>
          </div>
          
          <h3 className="text-white text-2xl font-bold mb-2 leading-tight">
            Bereik lokale<br />bezoekers
          </h3>
          
          <p className="text-white/90 text-sm mb-4 max-w-[200px]">
            Promoot jouw bedrijf bij duizenden evenementbezoekers in de regio
          </p>
          
          <div className="inline-flex items-center gap-2 bg-white text-teal-600 px-4 py-2 rounded-full font-semibold text-sm group-hover:bg-teal-50 transition-colors w-fit">
            <span>Adverteer op letsgo radar</span>
            <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

  return (
    <div className="w-full h-full bg-gray-100 rounded-2xl flex items-center justify-center">
      <span className="text-gray-400">Advertentieruimte</span>
    </div>
  );
}
