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

interface RadarLogoWithTextProps {
  height?: number;
  className?: string;
  color?: string;
  textColor?: string;
}

export function RadarLogoWithText({ 
  height = 32, 
  className = "", 
  color = "#14B8A6",
  textColor = "currentColor"
}: RadarLogoWithTextProps) {
  const radarSize = height;
  const fontSize = height * 0.7;
  const width = height * 6;
  
  return (
    <svg 
      width={width} 
      height={height} 
      viewBox="0 0 240 40" 
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <text 
        x="0" 
        y="30" 
        fontFamily="system-ui, -apple-system, sans-serif" 
        fontWeight="700" 
        fontSize="26"
        fill={textColor}
      >
        letsg
      </text>
      
      <g transform="translate(62, 0)">
        <circle cx="20" cy="20" r="18" stroke={color} strokeWidth="1.5" fill="none" opacity="0.3" />
        <circle cx="20" cy="20" r="13" stroke={color} strokeWidth="1.2" fill="none" opacity="0.5" />
        <circle cx="20" cy="20" r="8" stroke={color} strokeWidth="1" fill="none" opacity="0.7" />
        <circle cx="20" cy="20" r="3" fill={color} />
        <path d="M20 20 L20 4 A16 16 0 0 1 34 12 Z" fill={color} opacity="0.4"/>
        <line x1="20" y1="20" x2="32" y2="8" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="32" cy="8" r="2" fill={color} />
      </g>
      
      <text 
        x="105" 
        y="30" 
        fontFamily="system-ui, -apple-system, sans-serif" 
        fontWeight="700" 
        fontSize="26"
        fill={textColor}
      >
        radar
      </text>
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
