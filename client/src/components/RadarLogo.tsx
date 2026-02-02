interface RadarLogoProps {
  size?: number;
  className?: string;
  color?: string;
}

export function RadarLogo({ size = 32, className = "", color = "#14B8A6" }: RadarLogoProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="50" cy="50" r="45" stroke={color} strokeWidth="3" fill="none" opacity="0.3" />
      <circle cx="50" cy="50" r="32" stroke={color} strokeWidth="2.5" fill="none" opacity="0.5" />
      <circle cx="50" cy="50" r="19" stroke={color} strokeWidth="2" fill="none" opacity="0.7" />
      <circle cx="50" cy="50" r="6" fill={color} />
      
      <path 
        d="M50 50 L50 8 A42 42 0 0 1 85 32 Z" 
        fill={color} 
        opacity="0.4"
      />
      
      <line x1="50" y1="50" x2="78" y2="22" stroke={color} strokeWidth="3" strokeLinecap="round" />
      
      <circle cx="78" cy="22" r="4" fill={color} />
    </svg>
  );
}

export function RadarLogoAnimated({ size = 32, className = "", color = "#14B8A6" }: RadarLogoProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="50" cy="50" r="45" stroke={color} strokeWidth="3" fill="none" opacity="0.3" />
      <circle cx="50" cy="50" r="32" stroke={color} strokeWidth="2.5" fill="none" opacity="0.5" />
      <circle cx="50" cy="50" r="19" stroke={color} strokeWidth="2" fill="none" opacity="0.7" />
      <circle cx="50" cy="50" r="6" fill={color} />
      
      <g style={{ transformOrigin: '50px 50px', animation: 'radarSweep 3s linear infinite' }}>
        <path 
          d="M50 50 L50 8 A42 42 0 0 1 85 32 Z" 
          fill={color} 
          opacity="0.4"
        />
        <line x1="50" y1="50" x2="78" y2="22" stroke={color} strokeWidth="3" strokeLinecap="round" />
        <circle cx="78" cy="22" r="4" fill={color} />
      </g>
      
      <style>{`
        @keyframes radarSweep {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </svg>
  );
}
